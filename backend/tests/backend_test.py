"""PayMitra HRMS Backend API Tests"""
import os
import io
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://employee-owner-saas.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "ashwanibarabanki1438@gmail.com"
OWNER_PASSWORD = "Owner@12345"
EMP_EMAIL = "priya@paymitra-demo.in"
EMP_PASSWORD = "Welcome@123"


@pytest.fixture(scope="session")
def owner_token():
    r = requests.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"owner login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def emp_token():
    r = requests.post(f"{API}/auth/login", json={"email": EMP_EMAIL, "password": EMP_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"emp login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def H(token):
    return {"Authorization": f"Bearer {token}"}


# -- Auth --
def test_owner_login(owner_token):
    assert owner_token
    me = requests.get(f"{API}/auth/me", headers=H(owner_token)).json()
    assert me["role"] == "owner"
    assert me["email"] == OWNER_EMAIL


def test_emp_login(emp_token):
    me = requests.get(f"{API}/auth/me", headers=H(emp_token)).json()
    assert me["role"] == "employee"


def test_invalid_login():
    r = requests.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": "wrong"})
    assert r.status_code == 401


# -- Dashboard --
def test_owner_dashboard(owner_token):
    r = requests.get(f"{API}/dashboard/owner", headers=H(owner_token))
    assert r.status_code == 200
    d = r.json()
    for k in ["headcount", "present_today", "absent_today", "pending_leaves", "payroll_total",
              "advances_outstanding", "payroll_trend", "dept_distribution"]:
        assert k in d
    assert d["headcount"] >= 5


def test_employee_dashboard(emp_token):
    r = requests.get(f"{API}/dashboard/employee", headers=H(emp_token))
    assert r.status_code == 200
    d = r.json()
    assert "employee" in d and "leave_balances" in d


# -- Employees --
def test_list_employees(owner_token):
    r = requests.get(f"{API}/employees", headers=H(owner_token))
    assert r.status_code == 200
    assert len(r.json()) >= 5


def test_employee_crud(owner_token):
    payload = {
        "name": "TEST_John", "phone": "9999999999", "email": "test_john_bkend@paymitra-demo.in",
        "department": "QA", "designation": "Tester", "doj": "2024-04-01",
        "salary": {"ctc": 30000, "basic": 15000, "hra": 6000, "other": 9000,
                   "pf_applicable": True, "esi_applicable": False}
    }
    # Clean up if exists (login attempt as user shouldn't be possible - just try create)
    r = requests.post(f"{API}/employees", json=payload, headers=H(owner_token))
    if r.status_code == 400:
        # already exists -> get list and find
        emps = requests.get(f"{API}/employees", headers=H(owner_token)).json()
        emp = next((e for e in emps if e["email"] == payload["email"]), None)
        assert emp
        emp_id = emp["id"]
    else:
        assert r.status_code == 200, r.text
        emp_id = r.json()["id"]

    # GET
    g = requests.get(f"{API}/employees/{emp_id}", headers=H(owner_token))
    assert g.status_code == 200
    assert g.json()["email"] == payload["email"]

    # UPDATE
    u = requests.put(f"{API}/employees/{emp_id}", json={"designation": "Senior Tester"}, headers=H(owner_token))
    assert u.status_code == 200
    assert u.json()["designation"] == "Senior Tester"

    # Deactivate
    d = requests.put(f"{API}/employees/{emp_id}", json={"status": "inactive"}, headers=H(owner_token))
    assert d.status_code == 200
    assert d.json()["status"] == "inactive"

    # Activate
    d = requests.put(f"{API}/employees/{emp_id}", json={"status": "active"}, headers=H(owner_token))
    assert d.status_code == 200


def test_csv_template_download(owner_token):
    r = requests.get(f"{API}/employees/template/csv", headers=H(owner_token))
    assert r.status_code == 200
    assert "Name" in r.text
    assert "text/csv" in r.headers.get("content-type", "")


def test_csv_export(owner_token):
    r = requests.get(f"{API}/employees/export/csv", headers=H(owner_token))
    assert r.status_code == 200
    lines = r.text.strip().split("\n")
    assert len(lines) >= 2


def test_csv_import(owner_token):
    csv_content = (
        "Name,Phone,Email,Department,Designation,Date of Joining (DD-MM-YYYY),Monthly CTC,Basic,HRA,Other Allowances,PF Applicable (Y/N),ESI Applicable (Y/N)\n"
        "TEST_Import1,9998887777,test_imp_bkend1@paymitra-demo.in,QA,Analyst,01-04-2024,25000,12500,5000,7500,Y,N\n"
        ",bad,bademail,QA,X,01-04-2024,0,0,0,0,N,N\n"
    )
    files = {"file": ("import.csv", csv_content, "text/csv")}
    r = requests.post(f"{API}/employees/import/csv", files=files, headers=H(owner_token))
    assert r.status_code == 200
    data = r.json()
    assert data["created"] >= 0  # may be 0 if re-run
    # bad row should be reported
    assert len(data["errors"]) >= 1


# -- Attendance --
def test_mark_attendance(owner_token):
    emps = requests.get(f"{API}/employees", headers=H(owner_token)).json()
    emp = emps[0]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    r = requests.post(f"{API}/attendance/mark",
                      json={"employee_id": emp["id"], "date": today, "status": "present"},
                      headers=H(owner_token))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "present"


def test_get_attendance_month(owner_token):
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    r = requests.get(f"{API}/attendance?month={month}", headers=H(owner_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_employee_punch(emp_token):
    r = requests.post(f"{API}/attendance/punch",
                      json={"kind": "in", "lat": 12.9716, "lng": 77.5946},
                      headers=H(emp_token))
    assert r.status_code == 200, r.text
    rec = r.json()
    assert rec.get("geofence_in") in ("inside", "recorded"), f"unexpected geofence: {rec.get('geofence_in')}"


def test_employee_punch_outside(emp_token):
    r = requests.post(f"{API}/attendance/punch",
                      json={"kind": "out", "lat": 20.0, "lng": 78.0},
                      headers=H(emp_token))
    assert r.status_code == 200
    # Should be outside if geofence exists
    assert r.json().get("geofence_out") in ("outside", "recorded")


# -- Shifts / Rules / Geofences --
def test_shift_crud(owner_token):
    r = requests.post(f"{API}/shifts",
                      json={"name": "TEST_Morning", "start_time": "09:00", "end_time": "18:00",
                            "working_hours": 8, "week_offs": ["sun"]},
                      headers=H(owner_token))
    assert r.status_code == 200
    sid = r.json()["id"]
    lst = requests.get(f"{API}/shifts", headers=H(owner_token)).json()
    assert any(s["id"] == sid for s in lst)
    requests.delete(f"{API}/shifts/{sid}", headers=H(owner_token))


def test_rule_set_crud(owner_token):
    r = requests.post(f"{API}/rule-sets",
                      json={"name": "TEST_Rules", "late_entry": {"grace_min": 10, "fine": 100}},
                      headers=H(owner_token))
    assert r.status_code == 200
    rid = r.json()["id"]
    requests.delete(f"{API}/rule-sets/{rid}", headers=H(owner_token))


def test_geofence_crud(owner_token):
    r = requests.post(f"{API}/geofences",
                      json={"name": "TEST_Fence", "lat": 12.97, "lng": 77.59, "radius": 200},
                      headers=H(owner_token))
    assert r.status_code == 200
    gid = r.json()["id"]
    requests.delete(f"{API}/geofences/{gid}", headers=H(owner_token))


# -- Leaves --
def test_apply_and_approve_leave(emp_token, owner_token):
    r = requests.post(f"{API}/leaves",
                      json={"type": "casual", "from_date": "2026-02-01", "to_date": "2026-02-01",
                            "reason": "TEST leave"},
                      headers=H(emp_token))
    assert r.status_code == 200, r.text
    lid = r.json()["id"]

    lst = requests.get(f"{API}/leaves?status=pending", headers=H(owner_token)).json()
    assert any(l["id"] == lid for l in lst)

    d = requests.post(f"{API}/leaves/{lid}/decision", json={"decision": "approved"}, headers=H(owner_token))
    assert d.status_code == 200
    assert d.json()["status"] == "approved"


# -- Payroll --
def test_run_payroll_and_pdf(owner_token):
    month = "2026-01"
    r = requests.post(f"{API}/payroll/run", json={"month": month}, headers=H(owner_token), timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["run"]["month"] == month
    assert len(data["payslips"]) >= 5
    slip = data["payslips"][0]
    assert "gross" in slip and "deductions" in slip and "net" in slip

    # PDF
    pdf = requests.get(f"{API}/payslips/{slip['id']}/pdf", headers=H(owner_token))
    assert pdf.status_code == 200
    assert pdf.content[:4] == b"%PDF"

    # Mark paid
    pay = requests.post(f"{API}/payslips/{slip['id']}/pay", json={"method": "bank"}, headers=H(owner_token))
    assert pay.status_code == 200

    # Salary CSV
    csv_r = requests.get(f"{API}/reports/salary/csv?month={month}", headers=H(owner_token))
    assert csv_r.status_code == 200


def test_advance_and_adjustment(owner_token):
    emps = requests.get(f"{API}/employees", headers=H(owner_token)).json()
    emp = emps[0]
    r = requests.post(f"{API}/advances",
                      json={"employee_id": emp["id"], "amount": 5000, "reason": "TEST", "monthly_recovery": 1000},
                      headers=H(owner_token))
    assert r.status_code == 200
    a = requests.post(f"{API}/adjustments",
                      json={"employee_id": emp["id"], "month": "2026-01", "type": "bonus", "amount": 2000, "note": "TEST"},
                      headers=H(owner_token))
    assert a.status_code == 200


# -- Role isolation --
def test_employee_cannot_access_owner_endpoints(emp_token):
    r = requests.get(f"{API}/dashboard/owner", headers=H(emp_token))
    assert r.status_code == 403
    r2 = requests.post(f"{API}/employees",
                       json={"name": "hack", "email": "hack@x.com", "salary": {}},
                       headers=H(emp_token))
    assert r2.status_code == 403


def test_employee_payslip_isolation(emp_token, owner_token):
    # emp can only see their own payslips
    mine = requests.get(f"{API}/payslips", headers=H(emp_token)).json()
    me = requests.get(f"{API}/auth/me", headers=H(emp_token)).json()
    for s in mine:
        assert s["employee_id"] == me["employee_id"]


def test_unauthenticated():
    r = requests.get(f"{API}/employees")
    assert r.status_code == 401
