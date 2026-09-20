# HRMS & Payroll SaaS — Build Plan

A responsive web application for Indian small/medium businesses to manage staff
attendance, leave, salary and payslips — inspired by PagarBook's functionality and
clean, mobile-first feel. It works for both the business owner/admin and for
individual employees, each with their own login and view.

Note on design: the look and feel will be built in the same spirit as PagarBook
(clean, mobile-first, simple for non-technical owners) using original graphics and
layout. Their exact logo, images and copy will not be reproduced.

## Who uses it

- **Owner / Admin** — sets up the company, adds staff, runs attendance and payroll,
  approves leave, generates payslips, sees the dashboard.
- **Employee** — logs in to see their own attendance, apply for leave, view advances
  and download their own payslips.
- Each owner gets their own isolated company workspace (multi-company SaaS): staff and
  data of one company are never visible to another.

## What the first version includes

### 1. Accounts & login
- Email + password sign-up and login.
- An owner signs up and creates a company; employees are added by the owner and log in
  with their own credentials.
- Role-based access: owner/admin sees everything for their company; an employee sees
  only their own records.

### 2. Employee directory & profiles
- Add, edit and deactivate staff (manual, one at a time).
- **Bulk upload staff via CSV/Excel** using a downloadable template, plus a matching
  **export/download** of all staff in the same format. Column format (in order):
  1. Name
  2. Phone
  3. Email
  4. Department
  5. Designation
  6. Date of Joining (DD-MM-YYYY)
  7. Monthly CTC
  8. Basic
  9. HRA
  10. Other Allowances
  11. PF Applicable (Y/N)
  12. ESI Applicable (Y/N)
  On import, rows are validated (required fields, valid email/phone, numbers that add
  up) and any bad rows are reported back so they can be fixed and re-uploaded.
- Profile holds: name, phone, email, department/designation, date of joining,
  salary structure, a registered reference face photo (for attendance), and uploaded
  documents (e.g. ID proof, letters).
- Bulk view of all staff with search and filters.

### 3. Attendance
- Daily attendance marking: Present, Absent, Half-day, Paid/Unpaid leave, Week-off.
- Owner/admin can mark attendance for staff (single or bulk for a day).
- **Employee self check-in / check-out** with a button that records the timestamp, and:
  - **Selfie capture** — the browser camera takes a photo at check-in/out, stored with the record and visible to the owner.
  - **Location capture** — the browser's GPS location (latitude/longitude) is recorded with each punch. The owner defines **geofences** per site (a location plus an allowed radius); a punch is auto-tagged as inside or outside the geofence, and out-of-range punches are flagged for review.
  - **Facial recognition** — each employee registers a reference face photo once; at check-in the live selfie is matched against it in the browser and the result (match / no match + confidence) is stored. See the note below.
- Overtime hours and late-entry can be recorded and carried into salary.
- Monthly attendance register view (whole month per person, per day).

Note on facial recognition: this is a **browser-based, best-effort face match** (live selfie compared to the registered photo using an in-browser face-recognition library). It works on a normal phone/laptop camera with no extra hardware, but it is not a certified enterprise biometric system and accuracy depends on lighting and camera quality. A physical biometric device is still out of scope.

### 3a. Shifts & automation rules (template-based)

**Shift templates** — the owner defines reusable shift templates and assigns them to
staff, teams or sites (multiple shifts supported):
- Shift name, start time, end time, working hours, and week-offs.
- A single employee can be moved between shifts, and different teams/sites can run
  different shifts at the same time.

**Automation rules** — reusable rule templates that run automatically on each punch and
feed straight into payroll. Each rule is configurable:
- **Late entry** — grace period, then a deduction based on how late (time-slab based),
  applied either as a flat amount or as a multiplier (e.g. 1x / custom multiplier of the
  per-minute or per-hour wage).
- **Early exit** — hours short of the shift end counted by the rule, with a deduction
  (flat or multiplier).
- **Overtime** — hours worked beyond shift end, paid at a configurable rate/multiplier
  (e.g. 1.5x), with an optional daily/weekly cap.
- **Early overtime** — hours worked before shift start, paid at its own rate/multiplier.
- **Break rules** — allowed break duration; time beyond it is counted separately and can
  trigger a deduction.
Rules are saved as templates and attached to a shift or a group of staff, so a rule set
is defined once and reused. The outcome of every rule (fine, overtime pay, etc.) is
recorded on the attendance record and flows into the monthly payroll run.
- Leave types with balances (e.g. Casual, Sick), configurable per company.
- Employee applies for leave; owner/admin approves or rejects.
- Leave balances update automatically and feed into payroll.

### 5. Salary structure & payroll (India)
- Per-employee salary structure: Basic, HRA, allowances, and custom earning/deduction
  components.
- Statutory calculations: PF, ESI, Professional Tax and TDS, plus gratuity eligibility.
- Monthly payroll run that combines attendance, overtime, fines, leave, advances and
  statutory deductions to produce gross, deductions and net payable.
- Salary advances / loans that are recorded and auto-recovered in payroll.
- Bonuses and one-off adjustments.

### 6. Payslips
- Generate a professional payslip per employee per month, downloadable as PDF.
- Employees can view and download their own payslips.

### 7. Payments (record only in this version)
- After a payroll run, owner marks salaries as Paid and keeps a payment log/history.
- Real bank/gateway payouts (Stripe/Razorpay) are **not** wired up in this first
  version — see "Assumptions" below.

### 8. Dashboards & reports
- **Owner dashboard:** headcount, present/absent today, pending leave approvals,
  monthly payroll total, advances outstanding, and simple charts.
- **Employee dashboard:** their attendance summary, leave balance, latest payslip.
- Reports: monthly attendance register, salary register and payment log, exportable.

## Deliberately left out of the first version (can be added later)

- Real salary payouts through a payment gateway (Stripe / Razorpay).
- A physical biometric / face device (browser-based face match is included instead).
- Continuous field-team live tracking / route history (single-punch GPS + geofence is included).
- Native Android/iOS apps (the web app is fully responsive and works in a mobile
  browser; native apps are a later step).
- Full statutory e-filing (Form 24Q, Form 16 generation, TDS challans), recruitment/job
  postings, performance reviews, asset management, and a business cashbook. These exist
  in PagarBook but are out of scope for the first build.

## Assumptions made (challenge any of these)

1. **Payments:** the first version generates payslips and records payments manually
   ("mark as paid"). Real gateway payouts are deferred. If you want live payouts now,
   that adds a payment-gateway integration.
2. **Statutory accuracy:** PF/ESI/PT/TDS use standard India rates and slabs configurable
   in settings. This is a working payroll calculator, not a certified compliance/e-filing
   tool.
3. **Multi-company:** included, since it was selected — each owner manages one company
   workspace, isolated from others.
4. **Design:** original UI built in the spirit of PagarBook (mobile-first, simple),
   not a pixel copy of their site or assets.

## Seed data for demo
- One demo owner account and a few sample employees with attendance, a salary structure,
  and one completed payroll run, so the dashboards and payslips are populated on first
  open. Login credentials will be provided after the build.
