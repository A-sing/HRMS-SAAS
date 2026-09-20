"""India payroll engine: attendance rules + monthly salary computation."""
import calendar
from num2words import num2words


def _time_to_minutes(t: str) -> int:
    if not t:
        return 0
    h, m = t.split(":")[:2]
    return int(h) * 60 + int(m)


def per_minute_wage(ctc: float, working_hours: float) -> float:
    wh = working_hours or 8
    return ctc / 30.0 / wh / 60.0


def apply_rules(record: dict, shift: dict, rule_set: dict, ctc: float) -> dict:
    """Compute late fine, early-exit fine, overtime pay from a punch pair."""
    out = {"late_minutes": 0, "early_exit_hours": 0.0, "overtime_hours": 0.0,
           "fine": 0.0, "ot_pay": 0.0}
    if not shift or not record.get("check_in") or not record.get("check_out"):
        return out
    pmw = per_minute_wage(ctc, shift.get("working_hours", 8))
    ci = _time_to_minutes(record["check_in"][11:16]) if len(record["check_in"]) > 11 else _time_to_minutes(record["check_in"])
    co = _time_to_minutes(record["check_out"][11:16]) if len(record["check_out"]) > 11 else _time_to_minutes(record["check_out"])
    s_start = _time_to_minutes(shift.get("start_time", "09:00"))
    s_end = _time_to_minutes(shift.get("end_time", "18:00"))
    rs = rule_set or {}

    # Late entry
    le = rs.get("late_entry", {})
    if le.get("enabled"):
        grace = le.get("grace_minutes", 10)
        late = max(0, ci - s_start - grace)
        out["late_minutes"] = late
        if late > 0:
            if le.get("mode") == "flat":
                out["fine"] += le.get("amount", 0)
            else:
                out["fine"] += late * pmw * le.get("multiplier", 1)

    # Early exit
    ee = rs.get("early_exit", {})
    if ee.get("enabled"):
        early = max(0, s_end - co)
        out["early_exit_hours"] = round(early / 60.0, 2)
        if early > 0:
            if ee.get("mode") == "flat":
                out["fine"] += ee.get("amount", 0)
            else:
                out["fine"] += early * pmw * ee.get("multiplier", 1)

    # Overtime (after shift end)
    ot = rs.get("overtime", {})
    if ot.get("enabled"):
        extra = max(0, co - s_end)
        cap = ot.get("daily_cap_hours", 4) * 60
        extra = min(extra, cap)
        out["overtime_hours"] = round(extra / 60.0, 2)
        out["ot_pay"] += extra * pmw * ot.get("multiplier", 1.5)

    # Early overtime (before shift start)
    eot = rs.get("early_overtime", {})
    if eot.get("enabled"):
        pre = max(0, s_start - ci)
        out["overtime_hours"] += round(pre / 60.0, 2)
        out["ot_pay"] += pre * pmw * eot.get("multiplier", 1.5)

    out["fine"] = round(out["fine"], 2)
    out["ot_pay"] = round(out["ot_pay"], 2)
    return out


# status weights toward payable days
PAID_STATUSES = {"present", "half_day", "paid_leave", "week_off"}
LOP_STATUSES = {"absent", "unpaid_leave"}


def compute_payslip(employee: dict, records: list, advances: list,
                    adjustments: list, settings: dict, month: str) -> dict:
    """month = 'YYYY-MM'. Returns full payslip breakdown."""
    year, mon = int(month[:4]), int(month[5:7])
    days_in_month = calendar.monthrange(year, mon)[1]
    sal = employee.get("salary", {})
    ctc = float(sal.get("ctc", 0))
    basic = float(sal.get("basic", 0))
    hra = float(sal.get("hra", 0))
    other = float(sal.get("other", 0))

    lop_days = 0.0
    present_days = 0.0
    total_fine = 0.0
    total_ot = 0.0
    for r in records:
        st = r.get("status")
        if st == "half_day":
            present_days += 0.5
            lop_days += 0.5
        elif st in PAID_STATUSES:
            present_days += 1
        elif st in LOP_STATUSES:
            lop_days += 1
        total_fine += float(r.get("fine", 0) or 0)
        total_ot += float(r.get("ot_pay", 0) or 0)

    payable_ratio = max(0.0, (days_in_month - lop_days) / days_in_month)
    earned_basic = round(basic * payable_ratio, 2)
    earned_hra = round(hra * payable_ratio, 2)
    earned_other = round(other * payable_ratio, 2)

    bonus = sum(float(a["amount"]) for a in adjustments if a.get("type") == "bonus")
    manual_ded = sum(float(a["amount"]) for a in adjustments if a.get("type") == "deduction")

    gross = round(earned_basic + earned_hra + earned_other + total_ot + bonus, 2)

    st = settings or {}
    # PF: 12% of basic capped at wage 15000
    pf = 0.0
    if sal.get("pf_applicable"):
        pf_wage = min(earned_basic, st.get("pf_wage_cap", 15000))
        pf = round(pf_wage * st.get("pf_rate", 12) / 100.0, 2)
    # ESI: 0.75% of gross if gross*12/12 <= threshold (monthly gross <= 21000)
    esi = 0.0
    if sal.get("esi_applicable") and gross <= st.get("esi_threshold", 21000):
        esi = round(gross * st.get("esi_rate", 0.75) / 100.0, 2)
    # Professional Tax (slab)
    pt = 0.0
    if gross > 15000:
        pt = st.get("pt_high", 200)
    elif gross > 10000:
        pt = st.get("pt_mid", 175)
    # TDS (simplified annual)
    annual = gross * 12
    tds = 0.0
    if annual > 1000000:
        tds = round(gross * 0.15, 2)
    elif annual > 750000:
        tds = round(gross * 0.10, 2)
    elif annual > 500000:
        tds = round(gross * 0.05, 2)

    # advance recovery
    adv_recovery = 0.0
    for a in advances:
        if a.get("status") == "active":
            rec = min(float(a.get("monthly_recovery", 0)), float(a.get("balance", 0)))
            adv_recovery += rec

    total_deductions = round(pf + esi + pt + tds + total_fine + manual_ded + adv_recovery, 2)
    net = round(gross - total_deductions, 2)

    try:
        words = num2words(int(round(net)), lang="en_IN").title() + " Rupees Only"
    except Exception:
        words = f"{int(round(net))} Rupees Only"

    return {
        "month": month,
        "days_in_month": days_in_month,
        "present_days": present_days,
        "lop_days": lop_days,
        "earnings": {
            "basic": earned_basic, "hra": earned_hra, "other_allowances": earned_other,
            "overtime": round(total_ot, 2), "bonus": round(bonus, 2),
        },
        "deductions": {
            "pf": pf, "esi": esi, "professional_tax": pt, "tds": tds,
            "fines": round(total_fine, 2), "advance_recovery": round(adv_recovery, 2),
            "other": round(manual_ded, 2),
        },
        "gross": gross,
        "total_deductions": total_deductions,
        "net": net,
        "net_in_words": words,
    }
