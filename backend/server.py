from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import os
import io
import csv
import math
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

from db import db, new_id, now_iso, NO_ID, ensure_indexes
from auth import (hash_password, verify_password, create_access_token,
                  get_current_user, require_owner, exchange_google_session)
from payroll import apply_rules, compute_payslip
from pdf_util import generate_payslip_pdf

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hrms")

app = FastAPI(title="PayMitra HRMS")
api = APIRouter(prefix="/api")

DEFAULT_SETTINGS = {
    "pf_rate": 12, "pf_wage_cap": 15000, "esi_rate": 0.75, "esi_threshold": 21000,
    "pt_high": 200, "pt_mid": 175,
}
DEFAULT_LEAVE_TYPES = [
    {"code": "casual", "name": "Casual Leave", "annual": 12},
    {"code": "sick", "name": "Sick Leave", "annual": 6},
    {"code": "earned", "name": "Earned Leave", "annual": 15},
]


# ---------- Schemas ----------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    company_name: str
    gstin: Optional[str] = ""
    address: Optional[str] = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleIn(BaseModel):
    session_id: str


class Salary(BaseModel):
    ctc: float = 0
    basic: float = 0
    hra: float = 0
    other: float = 0
    pf_applicable: bool = True
    esi_applicable: bool = False


class EmployeeIn(BaseModel):
    name: str
    phone: str = ""
    email: EmailStr
    department: str = ""
    designation: str = ""
    doj: str = ""
    salary: Salary = Field(default_factory=Salary)
    password: Optional[str] = None
    shift_id: Optional[str] = None
    rule_set_id: Optional[str] = None
    reference_face: Optional[str] = None


class AttendanceIn(BaseModel):
    employee_id: str
    date: str
    status: str
    check_in: Optional[str] = None
    check_out: Optional[str] = None


class PunchIn(BaseModel):
    kind: str
    selfie: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    face_match: Optional[dict] = None


class ShiftIn(BaseModel):
    name: str
    start_time: str = "09:00"
    end_time: str = "18:00"
    working_hours: float = 8
    week_offs: List[str] = []


class RuleSetIn(BaseModel):
    name: str
    late_entry: dict = {}
    early_exit: dict = {}
    overtime: dict = {}
    early_overtime: dict = {}
    break_rule: dict = {}


class GeofenceIn(BaseModel):
    name: str
    lat: float
    lng: float
    radius: float = 100


class LeaveIn(BaseModel):
    type: str
    from_date: str
    to_date: str
    reason: str = ""


class AdvanceIn(BaseModel):
    employee_id: str
    amount: float
    reason: str = ""
    monthly_recovery: float = 0


class AdjustmentIn(BaseModel):
    employee_id: str
    month: str
    type: str
    amount: float
    note: str = ""


# ---------- Helpers ----------
def public_user(u: dict) -> dict:
    u.pop("password_hash", None)
    return u


def days_between(a: str, b: str) -> int:
    d1 = datetime.strptime(a, "%Y-%m-%d").date()
    d2 = datetime.strptime(b, "%Y-%m-%d").date()
    return (d2 - d1).days + 1


async def get_company(cid: str) -> dict:
    c = await db.companies.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Company not found")
    return c


async def emp_for_user(user: dict) -> dict:
    emp = await db.employees.find_one({"id": user.get("employee_id")}, {"_id": 0})
    if not emp:
        raise HTTPException(404, "Employee profile not found")
    return emp


def haversine(lat1, lng1, lat2, lng2):
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------- Auth ----------
@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    company_id = new_id()
    user_id = new_id()
    await db.companies.insert_one({
        "id": company_id, "name": body.company_name, "owner_id": user_id,
        "gstin": body.gstin, "address": body.address, "logo": None,
        "settings": DEFAULT_SETTINGS, "leave_types": DEFAULT_LEAVE_TYPES,
        "created_at": now_iso(),
    })
    user = {
        "id": user_id, "name": body.name, "email": email,
        "password_hash": hash_password(body.password), "role": "owner",
        "company_id": company_id, "employee_id": None, "created_at": now_iso(),
    }
    await db.users.insert_one(dict(user))
    token = create_access_token(user_id, email, "owner")
    return {"token": token, "user": public_user(user)}


@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid email or password")
    token = create_access_token(user["id"], email, user["role"])
    return {"token": token, "user": public_user(user)}


@api.post("/auth/google")
async def google_login(body: GoogleIn):
    data = await exchange_google_session(body.session_id)
    email = data["email"].lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        company_id = new_id()
        user_id = new_id()
        await db.companies.insert_one({
            "id": company_id, "name": f"{data.get('name','My')} Company",
            "owner_id": user_id, "gstin": "", "address": "", "logo": None,
            "settings": DEFAULT_SETTINGS, "leave_types": DEFAULT_LEAVE_TYPES,
            "created_at": now_iso(),
        })
        user = {
            "id": user_id, "name": data.get("name", email), "email": email,
            "password_hash": "", "role": "owner", "company_id": company_id,
            "employee_id": None, "picture": data.get("picture"), "created_at": now_iso(),
        }
        await db.users.insert_one(dict(user))
    token = create_access_token(user["id"], email, user["role"])
    return {"token": token, "user": public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ---------- Company ----------
@api.get("/company")
async def get_my_company(user: dict = Depends(get_current_user)):
    return await get_company(user["company_id"])


@api.put("/company")
async def update_company(body: dict, user: dict = Depends(require_owner)):
    allowed = {k: body[k] for k in ("name", "gstin", "address", "logo", "settings", "leave_types") if k in body}
    await db.companies.update_one({"id": user["company_id"]}, {"$set": allowed})
    return await get_company(user["company_id"])


# ---------- Employees ----------
def default_balances(company):
    return {lt["code"]: lt["annual"] for lt in company.get("leave_types", DEFAULT_LEAVE_TYPES)}


@api.get("/employees")
async def list_employees(status: Optional[str] = None, q: Optional[str] = None,
                         user: dict = Depends(get_current_user)):
    query = {"company_id": user["company_id"]}
    if status:
        query["status"] = status
    emps = await db.employees.find(query, {"_id": 0}).to_list(1000)
    if q:
        ql = q.lower()
        emps = [e for e in emps if ql in (e.get("name", "") + e.get("department", "") + e.get("designation", "")).lower()]
    return emps


@api.post("/employees")
async def create_employee(body: EmployeeIn, user: dict = Depends(require_owner)):
    company = await get_company(user["company_id"])
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "A user with this email already exists")
    emp_id = new_id()
    emp = {
        "id": emp_id, "company_id": user["company_id"], "name": body.name,
        "phone": body.phone, "email": email, "department": body.department,
        "designation": body.designation, "doj": body.doj,
        "salary": body.salary.model_dump(), "shift_id": body.shift_id,
        "rule_set_id": body.rule_set_id, "reference_face": body.reference_face,
        "documents": [], "status": "active",
        "leave_balances": default_balances(company), "created_at": now_iso(),
    }
    await db.employees.insert_one(dict(emp))
    pwd = body.password or "Welcome@123"
    await db.users.insert_one({
        "id": new_id(), "name": body.name, "email": email,
        "password_hash": hash_password(pwd), "role": "employee",
        "company_id": user["company_id"], "employee_id": emp_id, "created_at": now_iso(),
    })
    return emp


@api.put("/employees/{emp_id}")
async def update_employee(emp_id: str, body: dict, user: dict = Depends(require_owner)):
    fields = {k: v for k, v in body.items() if k in
              ("name", "phone", "department", "designation", "doj", "salary",
               "shift_id", "rule_set_id", "reference_face", "status", "leave_balances", "documents")}
    r = await db.employees.update_one(
        {"id": emp_id, "company_id": user["company_id"]}, {"$set": fields})
    if not r.matched_count:
        raise HTTPException(404, "Employee not found")
    return await db.employees.find_one({"id": emp_id}, {"_id": 0})


@api.get("/employees/{emp_id}")
async def get_employee(emp_id: str, user: dict = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": emp_id, "company_id": user["company_id"]}, {"_id": 0})
    if not emp:
        raise HTTPException(404, "Employee not found")
    return emp


CSV_HEADERS = ["Name", "Phone", "Email", "Department", "Designation", "Date of Joining (DD-MM-YYYY)",
               "Monthly CTC", "Basic", "HRA", "Other Allowances", "PF Applicable (Y/N)", "ESI Applicable (Y/N)"]


@api.get("/employees/template/csv")
async def employee_template(user: dict = Depends(require_owner)):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(CSV_HEADERS)
    w.writerow(["Ramesh Kumar", "9876543210", "ramesh@example.com", "Sales", "Executive",
                "01-04-2024", "30000", "15000", "6000", "9000", "Y", "Y"])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=staff_template.csv"})


@api.get("/employees/export/csv")
async def export_employees(user: dict = Depends(require_owner)):
    emps = await db.employees.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(1000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(CSV_HEADERS)
    for e in emps:
        s = e.get("salary", {})
        doj = e.get("doj", "")
        if doj and "-" in doj and len(doj.split("-")[0]) == 4:
            y, m, d = doj.split("-")
            doj = f"{d}-{m}-{y}"
        w.writerow([e.get("name"), e.get("phone"), e.get("email"), e.get("department"),
                    e.get("designation"), doj, s.get("ctc"), s.get("basic"), s.get("hra"),
                    s.get("other"), "Y" if s.get("pf_applicable") else "N",
                    "Y" if s.get("esi_applicable") else "N"])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=staff_export.csv"})


@api.post("/employees/import/csv")
async def import_employees(file: UploadFile = File(...), user: dict = Depends(require_owner)):
    company = await get_company(user["company_id"])
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    created, errors = 0, []
    for i, row in enumerate(reader, start=2):
        try:
            name = (row.get(CSV_HEADERS[0]) or "").strip()
            email = (row.get(CSV_HEADERS[2]) or "").strip().lower()
            if not name or not email:
                errors.append({"row": i, "error": "Name and Email are required"})
                continue
            if "@" not in email:
                errors.append({"row": i, "error": "Invalid email"})
                continue
            if await db.users.find_one({"email": email}):
                errors.append({"row": i, "error": f"Email {email} already exists"})
                continue
            doj = (row.get(CSV_HEADERS[5]) or "").strip()
            if doj and "-" in doj and len(doj.split("-")[-1]) == 4:
                d, m, y = doj.split("-")
                doj = f"{y}-{m}-{d}"

            def num(k):
                try:
                    return float(row.get(k) or 0)
                except Exception:
                    return 0
            emp_id = new_id()
            emp = {
                "id": emp_id, "company_id": user["company_id"], "name": name,
                "phone": (row.get(CSV_HEADERS[1]) or "").strip(), "email": email,
                "department": (row.get(CSV_HEADERS[3]) or "").strip(),
                "designation": (row.get(CSV_HEADERS[4]) or "").strip(), "doj": doj,
                "salary": {"ctc": num(CSV_HEADERS[6]), "basic": num(CSV_HEADERS[7]),
                           "hra": num(CSV_HEADERS[8]), "other": num(CSV_HEADERS[9]),
                           "pf_applicable": (row.get(CSV_HEADERS[10]) or "").strip().upper() == "Y",
                           "esi_applicable": (row.get(CSV_HEADERS[11]) or "").strip().upper() == "Y"},
                "shift_id": None, "rule_set_id": None, "reference_face": None,
                "documents": [], "status": "active",
                "leave_balances": default_balances(company), "created_at": now_iso(),
            }
            await db.employees.insert_one(dict(emp))
            await db.users.insert_one({
                "id": new_id(), "name": name, "email": email,
                "password_hash": hash_password("Welcome@123"), "role": "employee",
                "company_id": user["company_id"], "employee_id": emp_id, "created_at": now_iso(),
            })
            created += 1
        except Exception as e:
            errors.append({"row": i, "error": str(e)})
    return {"created": created, "errors": errors}


# ---------- Shifts / Rules / Geofences ----------
@api.get("/shifts")
async def list_shifts(user: dict = Depends(get_current_user)):
    return await db.shifts.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(200)


@api.post("/shifts")
async def create_shift(body: ShiftIn, user: dict = Depends(require_owner)):
    doc = {"id": new_id(), "company_id": user["company_id"], **body.model_dump(), "created_at": now_iso()}
    await db.shifts.insert_one(dict(doc))
    return doc


@api.put("/shifts/{sid}")
async def update_shift(sid: str, body: ShiftIn, user: dict = Depends(require_owner)):
    await db.shifts.update_one({"id": sid, "company_id": user["company_id"]}, {"$set": body.model_dump()})
    return await db.shifts.find_one({"id": sid}, {"_id": 0})


@api.delete("/shifts/{sid}")
async def delete_shift(sid: str, user: dict = Depends(require_owner)):
    await db.shifts.delete_one({"id": sid, "company_id": user["company_id"]})
    return {"ok": True}


@api.get("/rule-sets")
async def list_rules(user: dict = Depends(get_current_user)):
    return await db.rule_sets.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(200)


@api.post("/rule-sets")
async def create_rules(body: RuleSetIn, user: dict = Depends(require_owner)):
    doc = {"id": new_id(), "company_id": user["company_id"], **body.model_dump(), "created_at": now_iso()}
    await db.rule_sets.insert_one(dict(doc))
    return doc


@api.put("/rule-sets/{rid}")
async def update_rules(rid: str, body: RuleSetIn, user: dict = Depends(require_owner)):
    await db.rule_sets.update_one({"id": rid, "company_id": user["company_id"]}, {"$set": body.model_dump()})
    return await db.rule_sets.find_one({"id": rid}, {"_id": 0})


@api.delete("/rule-sets/{rid}")
async def delete_rules(rid: str, user: dict = Depends(require_owner)):
    await db.rule_sets.delete_one({"id": rid, "company_id": user["company_id"]})
    return {"ok": True}


@api.get("/geofences")
async def list_geofences(user: dict = Depends(get_current_user)):
    return await db.geofences.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(200)


@api.post("/geofences")
async def create_geofence(body: GeofenceIn, user: dict = Depends(require_owner)):
    doc = {"id": new_id(), "company_id": user["company_id"], **body.model_dump(), "created_at": now_iso()}
    await db.geofences.insert_one(dict(doc))
    return doc


@api.delete("/geofences/{gid}")
async def delete_geofence(gid: str, user: dict = Depends(require_owner)):
    await db.geofences.delete_one({"id": gid, "company_id": user["company_id"]})
    return {"ok": True}


# ---------- Attendance ----------
async def recompute_record(record: dict, emp: dict):
    shift = await db.shifts.find_one({"id": emp.get("shift_id")}, {"_id": 0}) if emp.get("shift_id") else None
    rs = await db.rule_sets.find_one({"id": emp.get("rule_set_id")}, {"_id": 0}) if emp.get("rule_set_id") else None
    ctc = emp.get("salary", {}).get("ctc", 0)
    outcome = apply_rules(record, shift, rs, ctc)
    record.update(outcome)


@api.get("/attendance")
async def get_attendance(date: Optional[str] = None, month: Optional[str] = None,
                         employee_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"company_id": user["company_id"]}
    if user["role"] == "employee":
        query["employee_id"] = user["employee_id"]
    elif employee_id:
        query["employee_id"] = employee_id
    if date:
        query["date"] = date
    elif month:
        query["date"] = {"$regex": f"^{month}"}
    return await db.attendance.find(query, {"_id": 0}).to_list(5000)


@api.post("/attendance/mark")
async def mark_attendance(body: AttendanceIn, user: dict = Depends(require_owner)):
    emp = await db.employees.find_one({"id": body.employee_id, "company_id": user["company_id"]}, {"_id": 0})
    if not emp:
        raise HTTPException(404, "Employee not found")
    existing = await db.attendance.find_one({"employee_id": body.employee_id, "date": body.date}, {"_id": 0})
    rec = existing or {"id": new_id(), "company_id": user["company_id"],
                       "employee_id": body.employee_id, "date": body.date}
    rec.update({"status": body.status, "check_in": body.check_in or rec.get("check_in"),
                "check_out": body.check_out or rec.get("check_out")})
    rec.setdefault("fine", 0)
    rec.setdefault("ot_pay", 0)
    await recompute_record(rec, emp)
    await db.attendance.update_one({"employee_id": body.employee_id, "date": body.date},
                                   {"$set": rec}, upsert=True)
    return rec


@api.post("/attendance/bulk")
async def bulk_attendance(body: List[AttendanceIn], user: dict = Depends(require_owner)):
    out = []
    for item in body:
        out.append(await mark_attendance(item, user))
    return out


@api.post("/attendance/punch")
async def punch(body: PunchIn, user: dict = Depends(get_current_user)):
    if user["role"] != "employee":
        raise HTTPException(403, "Only employees can self-punch")
    emp = await emp_for_user(user)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    ts = datetime.now(timezone.utc).isoformat()
    rec = await db.attendance.find_one({"employee_id": emp["id"], "date": today}, {"_id": 0}) or {
        "id": new_id(), "company_id": user["company_id"], "employee_id": emp["id"],
        "date": today, "status": "present", "fine": 0, "ot_pay": 0}

    geo_status = "no_location"
    if body.lat is not None and body.lng is not None:
        fences = await db.geofences.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(100)
        geo_status = "outside"
        for f in fences:
            if haversine(body.lat, body.lng, f["lat"], f["lng"]) <= f["radius"]:
                geo_status = "inside"
                break
        if not fences:
            geo_status = "recorded"

    if body.kind == "in":
        rec["check_in"] = ts
        rec["selfie_in"] = body.selfie
        rec["location_in"] = {"lat": body.lat, "lng": body.lng}
        rec["geofence_in"] = geo_status
        rec["face_match_in"] = body.face_match
    else:
        rec["check_out"] = ts
        rec["selfie_out"] = body.selfie
        rec["location_out"] = {"lat": body.lat, "lng": body.lng}
        rec["geofence_out"] = geo_status
        rec["face_match_out"] = body.face_match

    rec["status"] = "present"
    await recompute_record(rec, emp)
    await db.attendance.update_one({"employee_id": emp["id"], "date": today},
                                   {"$set": rec}, upsert=True)
    return rec


# ---------- Leave ----------
@api.get("/leaves")
async def list_leaves(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"company_id": user["company_id"]}
    if user["role"] == "employee":
        query["employee_id"] = user["employee_id"]
    if status:
        query["status"] = status
    leaves = await db.leave_requests.find(query, {"_id": 0}).sort("applied_at", -1).to_list(1000)
    for l in leaves:
        emp = await db.employees.find_one({"id": l["employee_id"]}, {"_id": 0})
        l["employee_name"] = emp.get("name") if emp else ""
    return leaves


@api.post("/leaves")
async def apply_leave(body: LeaveIn, user: dict = Depends(get_current_user)):
    if user["role"] != "employee":
        raise HTTPException(403, "Only employees apply for leave")
    days = days_between(body.from_date, body.to_date)
    doc = {"id": new_id(), "company_id": user["company_id"], "employee_id": user["employee_id"],
           "type": body.type, "from_date": body.from_date, "to_date": body.to_date,
           "days": days, "reason": body.reason, "status": "pending",
           "applied_at": now_iso(), "decided_at": None}
    await db.leave_requests.insert_one(dict(doc))
    return doc


@api.post("/leaves/{lid}/decision")
async def decide_leave(lid: str, body: dict, user: dict = Depends(require_owner)):
    leave = await db.leave_requests.find_one({"id": lid, "company_id": user["company_id"]}, {"_id": 0})
    if not leave:
        raise HTTPException(404, "Leave not found")
    decision = body.get("decision")
    if decision not in ("approved", "rejected"):
        raise HTTPException(400, "Invalid decision")
    await db.leave_requests.update_one({"id": lid}, {"$set": {"status": decision, "decided_at": now_iso()}})
    if decision == "approved":
        emp = await db.employees.find_one({"id": leave["employee_id"]}, {"_id": 0})
        bal = emp.get("leave_balances", {})
        bal[leave["type"]] = max(0, bal.get(leave["type"], 0) - leave["days"])
        await db.employees.update_one({"id": emp["id"]}, {"$set": {"leave_balances": bal}})
    return {"ok": True, "status": decision}


# ---------- Advances & Adjustments ----------
@api.get("/advances")
async def list_advances(user: dict = Depends(get_current_user)):
    query = {"company_id": user["company_id"]}
    if user["role"] == "employee":
        query["employee_id"] = user["employee_id"]
    advs = await db.advances.find(query, {"_id": 0}).to_list(1000)
    for a in advs:
        emp = await db.employees.find_one({"id": a["employee_id"]}, {"_id": 0})
        a["employee_name"] = emp.get("name") if emp else ""
    return advs


@api.post("/advances")
async def create_advance(body: AdvanceIn, user: dict = Depends(require_owner)):
    doc = {"id": new_id(), "company_id": user["company_id"], "employee_id": body.employee_id,
           "amount": body.amount, "reason": body.reason, "balance": body.amount,
           "monthly_recovery": body.monthly_recovery or body.amount, "status": "active",
           "date": now_iso()}
    await db.advances.insert_one(dict(doc))
    return doc


@api.post("/adjustments")
async def create_adjustment(body: AdjustmentIn, user: dict = Depends(require_owner)):
    doc = {"id": new_id(), "company_id": user["company_id"], **body.model_dump(), "created_at": now_iso()}
    await db.adjustments.insert_one(dict(doc))
    return doc


@api.get("/adjustments")
async def list_adjustments(month: str, user: dict = Depends(require_owner)):
    return await db.adjustments.find({"company_id": user["company_id"], "month": month}, {"_id": 0}).to_list(1000)


# ---------- Payroll ----------
async def build_payslip(company, emp, month):
    records = await db.attendance.find(
        {"employee_id": emp["id"], "date": {"$regex": f"^{month}"}}, {"_id": 0}).to_list(500)
    advances = await db.advances.find(
        {"employee_id": emp["id"], "status": "active"}, {"_id": 0}).to_list(100)
    adjustments = await db.adjustments.find(
        {"employee_id": emp["id"], "month": month}, {"_id": 0}).to_list(100)
    return compute_payslip(emp, records, advances, adjustments, company.get("settings", {}), month)


@api.post("/payroll/run")
async def run_payroll(body: dict, user: dict = Depends(require_owner)):
    month = body.get("month")
    if not month:
        raise HTTPException(400, "month required (YYYY-MM)")
    company = await get_company(user["company_id"])
    emps = await db.employees.find({"company_id": user["company_id"], "status": "active"}, {"_id": 0}).to_list(2000)
    run_id = new_id()
    total_net = 0.0
    slips = []
    for emp in emps:
        ps = await build_payslip(company, emp, month)
        total_net += ps["net"]
        slip = {"id": new_id(), "company_id": user["company_id"], "run_id": run_id,
                "employee_id": emp["id"], "employee_name": emp["name"], "month": month,
                **ps, "paid": False, "paid_at": None, "payment_method": None,
                "generated_at": now_iso()}
        await db.payslips.replace_one(
            {"company_id": user["company_id"], "employee_id": emp["id"], "month": month},
            dict(slip), upsert=True)
        slips.append(slip)
    for emp in emps:
        for a in await db.advances.find({"employee_id": emp["id"], "status": "active"}, {"_id": 0}).to_list(100):
            rec = min(a["monthly_recovery"], a["balance"])
            new_bal = round(a["balance"] - rec, 2)
            await db.advances.update_one({"id": a["id"]}, {"$set": {
                "balance": new_bal, "status": "closed" if new_bal <= 0 else "active"}})
    run = {"id": run_id, "company_id": user["company_id"], "month": month,
           "status": "generated", "employee_count": len(emps), "total_net": round(total_net, 2),
           "generated_at": now_iso()}
    await db.payroll_runs.replace_one({"company_id": user["company_id"], "month": month},
                                      dict(run), upsert=True)
    return {"run": run, "payslips": slips}


@api.get("/payroll/runs")
async def list_runs(user: dict = Depends(require_owner)):
    return await db.payroll_runs.find({"company_id": user["company_id"]}, {"_id": 0}).sort("month", -1).to_list(100)


@api.get("/payslips")
async def list_payslips(month: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"company_id": user["company_id"]}
    if user["role"] == "employee":
        query["employee_id"] = user["employee_id"]
    if month:
        query["month"] = month
    return await db.payslips.find(query, {"_id": 0}).sort("month", -1).to_list(1000)


@api.post("/payslips/{pid}/pay")
async def mark_paid(pid: str, body: dict, user: dict = Depends(require_owner)):
    r = await db.payslips.update_one(
        {"id": pid, "company_id": user["company_id"]},
        {"$set": {"paid": True, "paid_at": now_iso(), "payment_method": body.get("method", "bank")}})
    if not r.matched_count:
        raise HTTPException(404, "Payslip not found")
    return {"ok": True}


@api.get("/payslips/{pid}/pdf")
async def payslip_pdf(pid: str, user: dict = Depends(get_current_user)):
    query = {"id": pid, "company_id": user["company_id"]}
    if user["role"] == "employee":
        query["employee_id"] = user["employee_id"]
    slip = await db.payslips.find_one(query, {"_id": 0})
    if not slip:
        raise HTTPException(404, "Payslip not found")
    company = await get_company(user["company_id"])
    emp = await db.employees.find_one({"id": slip["employee_id"]}, {"_id": 0}) or {"name": slip.get("employee_name", "")}
    pdf = generate_payslip_pdf(company, emp, slip)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=payslip_{slip['month']}.pdf"})


# ---------- Dashboard ----------
@api.get("/dashboard/owner")
async def owner_dashboard(user: dict = Depends(require_owner)):
    cid = user["company_id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month = today[:7]
    emps = await db.employees.find({"company_id": cid, "status": "active"}, {"_id": 0}).to_list(2000)
    today_att = await db.attendance.find({"company_id": cid, "date": today}, {"_id": 0}).to_list(2000)
    present = sum(1 for a in today_att if a.get("status") in ("present", "half_day"))
    on_leave = sum(1 for a in today_att if a.get("status") in ("paid_leave", "unpaid_leave"))
    marked = {a["employee_id"] for a in today_att}
    absent = sum(1 for e in emps if e["id"] not in marked) + \
        sum(1 for a in today_att if a.get("status") == "absent")
    pending_leaves = await db.leave_requests.count_documents({"company_id": cid, "status": "pending"})
    run = await db.payroll_runs.find_one({"company_id": cid, "month": month}, {"_id": 0})
    advances = await db.advances.find({"company_id": cid, "status": "active"}, {"_id": 0}).to_list(1000)
    adv_outstanding = round(sum(a["balance"] for a in advances), 2)

    runs = await db.payroll_runs.find({"company_id": cid}, {"_id": 0}).sort("month", 1).to_list(24)
    trend = [{"month": r["month"], "total": r["total_net"]} for r in runs][-6:]

    dept = {}
    for e in emps:
        d = e.get("department") or "Unassigned"
        dept[d] = dept.get(d, 0) + 1
    dept_dist = [{"name": k, "value": v} for k, v in dept.items()]

    return {
        "headcount": len(emps), "present_today": present, "absent_today": absent,
        "on_leave_today": on_leave, "pending_leaves": pending_leaves,
        "payroll_total": run["total_net"] if run else 0,
        "payroll_month": month, "advances_outstanding": adv_outstanding,
        "payroll_trend": trend, "dept_distribution": dept_dist,
    }


@api.get("/dashboard/employee")
async def employee_dashboard(user: dict = Depends(get_current_user)):
    if user["role"] != "employee":
        raise HTTPException(403, "Employee only")
    emp = await emp_for_user(user)
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    recs = await db.attendance.find({"employee_id": emp["id"], "date": {"$regex": f"^{month}"}}, {"_id": 0}).to_list(100)
    present = sum(1 for r in recs if r.get("status") in ("present", "half_day"))
    today_rec = next((r for r in recs if r["date"] == today), None)
    slip = await db.payslips.find_one({"employee_id": emp["id"]}, {"_id": 0}, sort=[("month", -1)])
    return {
        "employee": emp, "present_days": present, "leave_balances": emp.get("leave_balances", {}),
        "today": today_rec, "latest_payslip": slip,
    }


# ---------- Reports ----------
@api.get("/reports/attendance/csv")
async def report_attendance(month: str, user: dict = Depends(require_owner)):
    recs = await db.attendance.find({"company_id": user["company_id"], "date": {"$regex": f"^{month}"}}, {"_id": 0}).to_list(10000)
    emps = {e["id"]: e for e in await db.employees.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(2000)}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Employee", "Date", "Status", "Check In", "Check Out", "OT Hours", "Fine", "OT Pay", "Geofence"])
    for r in sorted(recs, key=lambda x: (x["employee_id"], x["date"])):
        e = emps.get(r["employee_id"], {})
        w.writerow([e.get("name", ""), r["date"], r.get("status"), r.get("check_in", ""),
                    r.get("check_out", ""), r.get("overtime_hours", 0), r.get("fine", 0),
                    r.get("ot_pay", 0), r.get("geofence_in", "")])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename=attendance_{month}.csv"})


@api.get("/reports/salary/csv")
async def report_salary(month: str, user: dict = Depends(require_owner)):
    slips = await db.payslips.find({"company_id": user["company_id"], "month": month}, {"_id": 0}).to_list(2000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Employee", "Gross", "PF", "ESI", "PT", "TDS", "Fines", "Advance", "Total Deductions", "Net", "Paid"])
    for s in slips:
        d = s["deductions"]
        w.writerow([s.get("employee_name"), s["gross"], d["pf"], d["esi"], d["professional_tax"],
                    d["tds"], d["fines"], d["advance_recovery"], s["total_deductions"], s["net"],
                    "Yes" if s.get("paid") else "No"])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename=salary_{month}.csv"})


app.include_router(api)
app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    from seed import seed_demo
    await seed_demo()


@app.on_event("shutdown")
async def shutdown():
    from db import client
    client.close()
