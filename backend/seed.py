"""Idempotent demo seed for PayMitra HRMS."""
import os
from datetime import datetime, timezone, timedelta
import calendar
from db import db, new_id, now_iso
from auth import hash_password
from payroll import compute_payslip

PROJ = {"_id": 0}
OWNER_EMAIL = os.environ.get("ADMIN_EMAIL", "owner@example.com")
OWNER_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Owner@12345")

SETTINGS = {"pf_rate": 12, "pf_wage_cap": 15000, "esi_rate": 0.75,
            "esi_threshold": 21000, "pt_high": 200, "pt_mid": 175}
LEAVE_TYPES = [
    {"code": "casual", "name": "Casual Leave", "annual": 12},
    {"code": "sick", "name": "Sick Leave", "annual": 6},
    {"code": "earned", "name": "Earned Leave", "annual": 15},
]

DEMO_EMPLOYEES = [
    {"name": "Priya Sharma", "phone": "9810011111", "email": "priya@paymitra-demo.in",
     "department": "Engineering", "designation": "Senior Developer",
     "salary": {"ctc": 60000, "basic": 30000, "hra": 15000, "other": 15000, "pf_applicable": True, "esi_applicable": False}},
    {"name": "Rahul Verma", "phone": "9810022222", "email": "rahul@paymitra-demo.in",
     "department": "Sales", "designation": "Sales Executive",
     "salary": {"ctc": 28000, "basic": 14000, "hra": 7000, "other": 7000, "pf_applicable": True, "esi_applicable": True}},
    {"name": "Anjali Gupta", "phone": "9810033333", "email": "anjali@paymitra-demo.in",
     "department": "HR", "designation": "HR Manager",
     "salary": {"ctc": 45000, "basic": 22500, "hra": 11250, "other": 11250, "pf_applicable": True, "esi_applicable": False}},
    {"name": "Vikram Singh", "phone": "9810044444", "email": "vikram@paymitra-demo.in",
     "department": "Operations", "designation": "Field Executive",
     "salary": {"ctc": 22000, "basic": 11000, "hra": 5500, "other": 5500, "pf_applicable": True, "esi_applicable": True}},
    {"name": "Sneha Reddy", "phone": "9810055555", "email": "sneha@paymitra-demo.in",
     "department": "Engineering", "designation": "QA Engineer",
     "salary": {"ctc": 40000, "basic": 20000, "hra": 10000, "other": 10000, "pf_applicable": True, "esi_applicable": False}},
]


async def seed_demo():
    if await db.users.find_one({"email": OWNER_EMAIL}, PROJ):
        return

    company_id = new_id()
    owner_id = new_id()
    await db.companies.insert_one({
        "id": company_id, "name": "Bharat Textiles Pvt Ltd", "owner_id": owner_id,
        "gstin": "27AABCB1234C1Z5", "address": "12, MG Road, Bengaluru, Karnataka 560001",
        "logo": None, "settings": SETTINGS, "leave_types": LEAVE_TYPES, "created_at": now_iso(),
    })
    await db.users.insert_one({
        "id": owner_id, "name": "Ashwani (Owner)", "email": OWNER_EMAIL,
        "password_hash": hash_password(OWNER_PASSWORD), "role": "owner",
        "company_id": company_id, "employee_id": None, "created_at": now_iso(),
    })

    shift = {"id": new_id(), "company_id": company_id, "name": "General Shift",
             "start_time": "09:30", "end_time": "18:30", "working_hours": 8,
             "week_offs": ["Sunday"], "created_at": now_iso()}
    await db.shifts.insert_one(dict(shift))

    rule_set = {"id": new_id(), "company_id": company_id, "name": "Standard Rules",
                "late_entry": {"enabled": True, "grace_minutes": 15, "mode": "multiplier", "multiplier": 1},
                "early_exit": {"enabled": True, "mode": "multiplier", "multiplier": 1},
                "overtime": {"enabled": True, "multiplier": 1.5, "daily_cap_hours": 3},
                "early_overtime": {"enabled": False, "multiplier": 1.5},
                "break_rule": {"enabled": False, "allowed_minutes": 60},
                "created_at": now_iso()}
    await db.rule_sets.insert_one(dict(rule_set))

    await db.geofences.insert_one({
        "id": new_id(), "company_id": company_id, "name": "Head Office",
        "lat": 12.9716, "lng": 77.5946, "radius": 150, "created_at": now_iso()})

    emp_ids = []
    for e in DEMO_EMPLOYEES:
        emp_id = new_id()
        emp_ids.append(emp_id)
        await db.employees.insert_one({
            "id": emp_id, "company_id": company_id, "name": e["name"], "phone": e["phone"],
            "email": e["email"], "department": e["department"], "designation": e["designation"],
            "doj": "2024-04-01", "salary": e["salary"], "shift_id": shift["id"],
            "rule_set_id": rule_set["id"], "reference_face": None, "documents": [],
            "status": "active", "leave_balances": {lt["code"]: lt["annual"] for lt in LEAVE_TYPES},
            "created_at": now_iso(),
        })
        await db.users.insert_one({
            "id": new_id(), "name": e["name"], "email": e["email"],
            "password_hash": hash_password("Welcome@123"), "role": "employee",
            "company_id": company_id, "employee_id": emp_id, "created_at": now_iso(),
        })

    # Attendance for current month (weekdays present up to today)
    today = datetime.now(timezone.utc).date()
    first = today.replace(day=1)
    statuses_cycle = ["present", "present", "present", "present", "half_day", "present", "absent"]
    day = first
    idx = 0
    while day <= today:
        if day.weekday() != 6:  # skip Sunday
            for j, emp_id in enumerate(emp_ids):
                st = statuses_cycle[(idx + j) % len(statuses_cycle)]
                rec = {"id": new_id(), "company_id": company_id, "employee_id": emp_id,
                       "date": day.strftime("%Y-%m-%d"), "status": st, "fine": 0, "ot_pay": 0}
                if st in ("present", "half_day"):
                    rec["check_in"] = day.strftime("%Y-%m-%dT09:35:00+00:00")
                    rec["check_out"] = day.strftime("%Y-%m-%dT18:40:00+00:00")
                    rec["geofence_in"] = "inside"
                    rec["overtime_hours"] = 0.16
                    rec["ot_pay"] = round(rec.get("ot_pay", 0) + 40, 2)
                await db.attendance.insert_one(dict(rec))
            idx += 1
        day += timedelta(days=1)

    # An advance for one employee
    await db.advances.insert_one({
        "id": new_id(), "company_id": company_id, "employee_id": emp_ids[1],
        "amount": 10000, "reason": "Personal emergency", "balance": 8000,
        "monthly_recovery": 2000, "status": "active", "date": now_iso()})

    # Payroll runs for previous 3 months (for trend + a completed run)
    company = await db.companies.find_one({"id": company_id}, PROJ)
    emps = await db.employees.find({"company_id": company_id}, PROJ).to_list(100)
    for back in (3, 2, 1):
        y, m = today.year, today.month - back
        while m <= 0:
            m += 12
            y -= 1
        month = f"{y:04d}-{m:02d}"
        run_id = new_id()
        total = 0.0
        for emp in emps:
            days_in_month = calendar.monthrange(y, m)[1]
            fake_records = [{"status": "present", "fine": 0, "ot_pay": 30}
                            for _ in range(days_in_month - 5)]
            ps = compute_payslip(emp, fake_records, [], [], SETTINGS, month)
            total += ps["net"]
            await db.payslips.replace_one(
                {"company_id": company_id, "employee_id": emp["id"], "month": month},
                {"id": new_id(), "company_id": company_id, "run_id": run_id,
                 "employee_id": emp["id"], "employee_name": emp["name"], "month": month,
                 **ps, "paid": back > 1, "paid_at": now_iso() if back > 1 else None,
                 "payment_method": "bank" if back > 1 else None, "generated_at": now_iso()},
                upsert=True)
        await db.payroll_runs.replace_one(
            {"company_id": company_id, "month": month},
            {"id": run_id, "company_id": company_id, "month": month, "status": "generated",
             "employee_count": len(emps), "total_net": round(total, 2), "generated_at": now_iso()},
            upsert=True)

    # A pending leave request
    await db.leave_requests.insert_one({
        "id": new_id(), "company_id": company_id, "employee_id": emp_ids[0],
        "type": "casual", "from_date": (today + timedelta(days=3)).strftime("%Y-%m-%d"),
        "to_date": (today + timedelta(days=4)).strftime("%Y-%m-%d"), "days": 2,
        "reason": "Family function", "status": "pending", "applied_at": now_iso(), "decided_at": None})
