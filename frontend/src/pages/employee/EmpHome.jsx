import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Money } from "@/components/common";
import { inr, prettyTime, monthLabel } from "@/lib/format";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarCheck, CalendarDays, FileText, Clock, ArrowRight, Loader2, MapPin } from "lucide-react";

export default function EmpHome() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/dashboard/employee").then((r) => setD(r.data)); }, []);
  if (!d) return <div className="grid h-64 place-items-center"><Loader2 className="animate-spin text-emerald-600" /></div>;

  const t = d.today;
  const totalLeave = Object.values(d.leave_balances || {}).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Hi, {user?.name?.split(" ")[0]} 👋</h1>
        <p className="text-sm text-slate-500">{d.employee?.designation} · {d.employee?.department}</p>
      </div>

      {/* Punch hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-emerald-100">Today's attendance</p>
            <div className="mt-1 flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5"><Clock size={15} /> In: {t?.check_in ? prettyTime(t.check_in) : "—"}</span>
              <span className="flex items-center gap-1.5">Out: {t?.check_out ? prettyTime(t.check_out) : "—"}</span>
            </div>
            {t?.geofence_in && <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs"><MapPin size={11} />{t.geofence_in}</span>}
          </div>
        </div>
        <Link to="/me/attendance" data-testid="goto-checkin-btn"
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-white py-3 font-semibold text-emerald-700 transition hover:bg-emerald-50">
          <CalendarCheck size={18} /> {t?.check_in && !t?.check_out ? "Check Out" : "Check In"} <ArrowRight size={16} />
        </Link>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card className="p-4" data-testid="emp-present-stat">
          <div className="text-xs uppercase text-slate-500">Present (this month)</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{d.present_days}</div>
        </Card>
        <Card className="p-4" data-testid="emp-leave-stat">
          <div className="text-xs uppercase text-slate-500">Leave balance</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{totalLeave}<span className="text-base text-slate-400"> days</span></div>
        </Card>
      </div>

      <Card className="mt-4 p-4">
        <div className="mb-3 text-xs font-semibold uppercase text-slate-500">Leave balances</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(d.leave_balances || {}).map(([k, v]) => (
            <span key={k} className="rounded-xl bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 capitalize">{k}: <b>{v}</b></span>
          ))}
        </div>
      </Card>

      {d.latest_payslip && (
        <Link to="/me/payslips">
          <Card className="mt-4 flex items-center justify-between p-4 hover:border-emerald-300" data-testid="latest-payslip-card">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><FileText size={18} /></span>
              <div><div className="font-medium text-slate-800">Latest Payslip · {monthLabel(d.latest_payslip.month)}</div>
                <div className="text-xs text-slate-500">Net <Money value={d.latest_payslip.net} /></div></div>
            </div>
            <ArrowRight size={18} className="text-slate-400" />
          </Card>
        </Link>
      )}
    </div>
  );
}
