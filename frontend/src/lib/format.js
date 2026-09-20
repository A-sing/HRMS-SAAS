export function inr(v) {
  const n = Number(v || 0);
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function inr2(v) {
  const n = Number(v || 0);
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function monthLabel(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function prettyDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function prettyTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export const ATT_STATUS = {
  present: { label: "Present", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  absent: { label: "Absent", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  half_day: { label: "Half Day", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  paid_leave: { label: "Paid Leave", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  unpaid_leave: { label: "Unpaid Leave", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  week_off: { label: "Week Off", cls: "bg-violet-50 text-violet-700 border-violet-200" },
};

export const LEAVE_STATUS = {
  pending: "bg-sky-50 text-sky-700 border-sky-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};
