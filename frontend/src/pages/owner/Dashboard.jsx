import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, StatCard, Card } from "@/components/common";
import { inr, monthLabel } from "@/lib/format";
import { Users, UserCheck, UserX, CalendarClock, Wallet, HandCoins, Loader2 } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#059669", "#2563eb", "#f59e0b", "#0ea5e9", "#db2777", "#7c3aed"];

export default function Dashboard() {
  const [d, setD] = useState(null);

  useEffect(() => { api.get("/dashboard/owner").then((r) => setD(r.data)); }, []);

  if (!d) return <div className="grid h-64 place-items-center"><Loader2 className="animate-spin text-emerald-600" /></div>;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Overview for ${monthLabel(d.payroll_month)}`} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard icon={Users} label="Active Staff" value={d.headcount} accent="slate" testid="owner-headcount-stat" />
        <StatCard icon={UserCheck} label="Present Today" value={d.present_today} accent="emerald" testid="owner-present-stat" />
        <StatCard icon={UserX} label="Absent Today" value={d.absent_today} accent="rose" testid="owner-absent-stat" />
        <StatCard icon={CalendarClock} label="Pending Leaves" value={d.pending_leaves} accent="amber" testid="owner-pending-leaves-stat" />
        <StatCard icon={Wallet} label="Payroll (This Month)" value={inr(d.payroll_total)} accent="blue" testid="owner-payroll-stat" sub="Run payroll to update" />
        <StatCard icon={HandCoins} label="Advances Outstanding" value={inr(d.advances_outstanding)} accent="amber" testid="owner-advances-stat" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold text-slate-800">Payroll Trend</h3>
          <p className="text-xs text-slate-500 mb-4">Net salary disbursed (last months)</p>
          <div className="h-64" data-testid="payroll-trend-chart">
            {d.payroll_trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.payroll_trend.map((t) => ({ ...t, label: monthLabel(t.month) }))}>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} fontSize={12} width={40} />
                  <Tooltip formatter={(v) => inr(v)} cursor={{ fill: "#ecfdf5" }} />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]} fill="#059669" barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-800">By Department</h3>
          <p className="text-xs text-slate-500 mb-2">Headcount split</p>
          <div className="h-56" data-testid="dept-chart">
            {d.dept_distribution.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.dept_distribution} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                    {d.dept_distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>
          <div className="space-y-1.5">
            {d.dept_distribution.map((x, i) => (
              <div key={x.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{x.name}</span>
                <span className="font-medium">{x.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

const Empty = () => <div className="grid h-full place-items-center text-sm text-slate-400">No data yet</div>;
