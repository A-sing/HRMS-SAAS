import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle, Paragraph,
                                Spacer)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

EMERALD = colors.HexColor("#059669")
NAVY = colors.HexColor("#0f172a")
LIGHT = colors.HexColor("#f1f5f9")


def _inr(v):
    try:
        v = float(v)
    except Exception:
        return "0"
    neg = v < 0
    s = f"{abs(v):.2f}"
    intp, dec = s.split(".")
    if len(intp) > 3:
        last3 = intp[-3:]
        rest = intp[:-3]
        parts = []
        while len(rest) > 2:
            parts.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            parts.insert(0, rest)
        intp = ",".join(parts) + "," + last3
    out = f"Rs. {intp}.{dec}"
    return ("-" + out) if neg else out


def generate_payslip_pdf(company: dict, employee: dict, payslip: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=15 * mm,
                            bottomMargin=15 * mm, leftMargin=15 * mm, rightMargin=15 * mm)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("t", parent=styles["Title"], textColor=NAVY, fontSize=18)
    sub = ParagraphStyle("s", parent=styles["Normal"], textColor=colors.grey, fontSize=9)
    h = ParagraphStyle("h", parent=styles["Normal"], textColor=colors.white,
                       fontSize=11, fontName="Helvetica-Bold")
    el = []

    el.append(Paragraph(company.get("name", "Company"), title))
    el.append(Paragraph(company.get("address", "") or "", sub))
    if company.get("gstin"):
        el.append(Paragraph(f"GSTIN: {company['gstin']}", sub))
    el.append(Spacer(1, 6))
    el.append(Paragraph(f"Payslip for {payslip['month']}", ParagraphStyle(
        "m", parent=styles["Heading2"], textColor=EMERALD)))
    el.append(Spacer(1, 6))

    info = [
        ["Employee", employee.get("name", ""), "Designation", employee.get("designation", "")],
        ["Employee ID", employee.get("id", "")[:8], "Department", employee.get("department", "")],
        ["Paid Days", str(payslip.get("present_days", "")), "LOP Days", str(payslip.get("lop_days", ""))],
    ]
    t = Table(info, colWidths=[30 * mm, 55 * mm, 30 * mm, 55 * mm])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.grey),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.grey),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
    ]))
    el.append(t)
    el.append(Spacer(1, 10))

    earn = payslip["earnings"]
    ded = payslip["deductions"]
    rows = [[Paragraph("Earnings", h), "", Paragraph("Deductions", h), ""]]
    earn_items = [("Basic", earn["basic"]), ("HRA", earn["hra"]),
                  ("Other Allowances", earn["other_allowances"]),
                  ("Overtime", earn["overtime"]), ("Bonus", earn["bonus"])]
    ded_items = [("Provident Fund", ded["pf"]), ("ESI", ded["esi"]),
                 ("Professional Tax", ded["professional_tax"]), ("TDS", ded["tds"]),
                 ("Fines", ded["fines"]), ("Advance Recovery", ded["advance_recovery"]),
                 ("Other Deductions", ded["other"])]
    n = max(len(earn_items), len(ded_items))
    for i in range(n):
        e = earn_items[i] if i < len(earn_items) else ("", "")
        d = ded_items[i] if i < len(ded_items) else ("", "")
        rows.append([e[0], _inr(e[1]) if e[0] else "", d[0], _inr(d[1]) if d[0] else ""])
    rows.append(["Gross Earnings", _inr(payslip["gross"]), "Total Deductions",
                 _inr(payslip["total_deductions"])])
    t2 = Table(rows, colWidths=[45 * mm, 40 * mm, 45 * mm, 40 * mm])
    t2.setStyle(TableStyle([
        ("SPAN", (0, 0), (1, 0)), ("SPAN", (2, 0), (3, 0)),
        ("BACKGROUND", (0, 0), (1, 0), EMERALD),
        ("BACKGROUND", (2, 0), (3, 0), NAVY),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"), ("ALIGN", (3, 0), (3, -1), "RIGHT"),
        ("BACKGROUND", (0, -1), (-1, -1), LIGHT),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("INNERGRID", (0, 1), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    el.append(t2)
    el.append(Spacer(1, 12))

    net = Table([["Net Payable", _inr(payslip["net"])]], colWidths=[85 * mm, 85 * mm])
    net.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), EMERALD),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 13),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    el.append(net)
    el.append(Spacer(1, 6))
    el.append(Paragraph(f"Amount in words: {payslip.get('net_in_words','')}", sub))
    el.append(Spacer(1, 12))
    el.append(Paragraph("This is a computer-generated payslip and does not require a signature.", sub))

    doc.build(el)
    return buf.getvalue()
