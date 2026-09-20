# PayMitra — HRMS & Payroll SaaS · PRD

## Original Problem Statement
"Need a HRMS and payroll software which will work employee and owner base, web and app, like a SaaS." Built for Indian SMBs, PagarBook-inspired, mobile-first, multi-company.

## Architecture
- **Backend**: FastAPI (`/app/backend`), modular — `server.py` (routes), `auth.py` (JWT), `payroll.py` (India statutory engine), `pdf_util.py` (payslip PDF via reportlab), `seed.py` (demo data), `db.py` (Mongo + helpers). All routes under `/api`.
- **Frontend**: React + Tailwind + shadcn/ui, Outfit/DM Sans fonts, framer-motion, recharts. Token (JWT) in localStorage `pm_token`, axios Bearer.
- **DB**: MongoDB, UUID string ids, `company_id` scoping for multi-tenant isolation.
- **Auth**: JWT email+password (owner signup creates company; employees created by owner) + Emergent-managed Google OAuth login.

## User Personas
- **Owner/Admin**: sets up company, manages staff, attendance, shifts/rules, leave approvals, payroll, payslips, settings, reports.
- **Employee**: self check-in/out (selfie+GPS+face), apply leave, view balances & own payslips.

## Core Requirements (static)
Auth & multi-company · Employee directory + CSV import/export · Attendance (owner marking + employee selfie/GPS/geofence/face punch) · Shift templates & automation rules (late/early/overtime) · Leave apply/approve with balances · Salary structure & monthly payroll (PF/ESI/PT/TDS) · Payslip PDF · Mark-as-paid log · Owner & employee dashboards · Reports (attendance & salary CSV).

## Implemented (2026-09-20) — v1, all tested 100%
- JWT auth (owner/employee) + Google login; role-based + company isolation
- Staff directory: add/edit/deactivate, search/filter, CSV template/import(validation)/export
- Attendance: daily marking (single/bulk), monthly register grid; employee selfie+GPS+geofence+browser face-match punch
- Shifts, automation rule sets, geofences (CRUD)
- Leave: apply, approve/reject, balance decrement, configurable leave types
- Payroll: monthly run, statutory PF/ESI/PT/TDS, advances (auto-recovery), bonus/deduction adjustments, mark paid, salary register CSV
- Payslips: professional PDF, owner + employee download
- Dashboards (owner KPIs + charts; employee summary), reports
- Demo seed: company "Bharat Textiles", 5 employees, attendance, payroll history, advance, pending leave

## Backlog / Remaining
- **P1**: Real payout gateway (Stripe/Razorpay), document uploads to object storage, employee profile face-register UX polish
- **P2**: Native mobile apps, statutory e-filing (Form 24Q/16), live field tracking, performance/recruitment modules, dark mode toggle in UI

## Notes
- Facial recognition is browser best-effort (face-api.js CDN, graceful fallback) — not certified biometric.
- Payments are "mark as paid" only (no live gateway) in v1.
- Statutory calc is a working calculator with configurable rates, not certified e-filing.

## Credentials
See `/app/memory/test_credentials.md`.
