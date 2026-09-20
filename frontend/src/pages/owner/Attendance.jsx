import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { PageHeader, Card, Pill } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ATT_STATUS, todayISO, currentMonth, prettyTime } from "@/lib/format";
import { Loader2, Save, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATUSES = ["present", "absent", "half_day", "paid_leave", "unpaid_leave", "week_off"];

export default function Attendance() {
  const [tab, setTab] = useState("day");
  const [date, setDate] = useState(todayISO());
  const [month, setMonth] = useState(currentMonth());
  const [emps, setEmps] = useState([]);
  const [recs, setRecs] = useState({});
  const [monthRecs, setMonthRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selfie, setSelfie] = useState(null);

  useEffect(() => { api.get("/employees", { params: { status: "active" } }).then((r) => setEmps(r.data)); }, []);

  const loadDay = async () => {
    setLoading(true);
    const { data } = await api.get("/attendance", { params: { date } });
    const map = {}; data.forEach((r) => (map[r.employee_id] = r));
    setRecs(map); setLoading(false);
  };
  const loadMonth = async () => {
    setLoading(true);
    const { data } = await api.get("/attendance", { params: { month } });
    setMonthRecs(data); setLoading(false);
  };
  useEffect(() => { if (tab === "day") loadDay(); else loadMonth(); /* eslint-disable-next-line */ }, [tab, date, month]);

  const setStatus = async (empId, status) => {
    try {
      const { data } = await api.post("/attendance/mark", { employee_id: empId, date, status });
      setRecs((p) => ({ ...p, [empId]: data }));
    } catch (e) { toast.error(apiError(e)); }
  };

  const markAll = async (status) => {
    const items = emps.map((e) => ({ employee_id: e.id, date, status }));
    const { data } = await api.post("/attendance/bulk", items);
    const map = {}; data.forEach((r) => (map[r.employee_id] = r)); setRecs(map);
    toast.success(`Marked all ${ATT_STATUS[status].label}`);
  };

  const daysInMonth = () => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m, 0).getDate();
  };

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Mark daily attendance or view the monthly register" />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList><TabsTrigger value="day" data-testid="tab-daily">Daily Marking</TabsTrigger><TabsTrigger value="month" data-testid="tab-monthly">Monthly Register</TabsTrigger></TabsList>
      </Tabs>

      {tab === "day" ? (
        <>
          <Card className="mb-4 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full sm:w-48" data-testid="attendance-date" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => markAll("present")} data-testid="mark-all-present">All Present</Button>
                <Button size="sm" variant="outline" onClick={() => markAll("week_off")} data-testid="mark-all-weekoff">All Week-off</Button>
              </div>
            </div>
          </Card>
          {loading ? <Loader /> : (
            <Card className="divide-y divide-slate-100">
              {emps.map((e) => {
                const r = recs[e.id];
                return (
                  <div key={e.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid={`att-row-${e.id}`}>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">{e.name}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        {e.department}
                        {r?.check_in && <span className="flex items-center gap-1">· in {prettyTime(r.check_in)}</span>}
                        {r?.selfie_in && <button onClick={() => setSelfie(r.selfie_in)} className="text-emerald-600 underline">selfie</button>}
                        {r?.geofence_in && <Pill className={r.geofence_in === "inside" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}><MapPin size={10} />{r.geofence_in}</Pill>}
                      </div>
                    </div>
                    <Select value={r?.status || ""} onValueChange={(v) => setStatus(e.id, v)}>
                      <SelectTrigger className="w-full sm:w-44" data-testid={`att-select-${e.id}`}><SelectValue placeholder="Not marked" /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{ATT_STATUS[s].label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                );
              })}
            </Card>
          )}
        </>
      ) : (
        <>
          <Card className="mb-4 p-3 sm:p-4"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full sm:w-48" data-testid="attendance-month" /></Card>
          {loading ? <Loader /> : (
            <Card className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="monthly-register">
                <thead className="bg-slate-50 text-slate-500">
                  <tr><th className="sticky left-0 bg-slate-50 px-3 py-2 text-left">Employee</th>
                    {Array.from({ length: daysInMonth() }, (_, i) => <th key={i} className="px-1.5 py-2 w-7">{i + 1}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {emps.map((e) => {
                    const byDate = {}; monthRecs.filter((r) => r.employee_id === e.id).forEach((r) => (byDate[r.date] = r));
                    return (
                      <tr key={e.id}>
                        <td className="sticky left-0 bg-white px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{e.name}</td>
                        {Array.from({ length: daysInMonth() }, (_, i) => {
                          const d = `${month}-${String(i + 1).padStart(2, "0")}`;
                          const r = byDate[d];
                          const code = r ? { present: "P", absent: "A", half_day: "H", paid_leave: "PL", unpaid_leave: "UL", week_off: "W" }[r.status] : "";
                          const cls = r ? ATT_STATUS[r.status].cls : "text-slate-300";
                          return <td key={i} className="px-1 py-1 text-center"><span className={`inline-block w-6 rounded ${r ? "border " + cls : ""} py-0.5 font-medium`}>{code || "·"}</span></td>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      <Dialog open={!!selfie} onOpenChange={(v) => !v && setSelfie(null)}>
        <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Check-in Selfie</DialogTitle></DialogHeader>
          {selfie && <img src={selfie} alt="selfie" className="w-full rounded-xl" />}</DialogContent>
      </Dialog>
    </div>
  );
}

const Loader = () => <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-emerald-600" /></div>;
