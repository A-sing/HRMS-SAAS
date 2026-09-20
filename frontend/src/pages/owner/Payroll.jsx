import React, { useEffect, useState } from "react";
import api, { API, apiError, TOKEN_KEY } from "@/lib/api";
import { PageHeader, Card, EmptyState, Money } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { inr, currentMonth, monthLabel } from "@/lib/format";
import { Wallet, Play, Download, FileText, CheckCircle2, HandCoins, Loader2, Plus } from "lucide-react";

export default function Payroll() {
  const [month, setMonth] = useState(currentMonth());
  const [slips, setSlips] = useState([]);
  const [emps, setEmps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [view, setView] = useState(null);
  const [advOpen, setAdvOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [adv, setAdv] = useState({ employee_id: "", amount: "", reason: "", monthly_recovery: "" });
  const [adj, setAdj] = useState({ employee_id: "", type: "bonus", amount: "", note: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/payslips", { params: { month } });
    setSlips(data); setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month]);
  useEffect(() => { api.get("/employees", { params: { status: "active" } }).then((r) => setEmps(r.data)); }, []);

  const run = async () => {
    setRunning(true);
    try { const { data } = await api.post("/payroll/run", { month }); toast.success(`Payroll generated · ${data.payslips.length} payslips`); load(); }
    catch (e) { toast.error(apiError(e)); } finally { setRunning(false); }
  };

  const pay = async (id) => { await api.post(`/payslips/${id}/pay`, { method: "bank" }); toast.success("Marked as paid"); load(); };
  const payAll = async () => { for (const s of slips.filter((x) => !x.paid)) await api.post(`/payslips/${s.id}/pay`, { method: "bank" }); toast.success("All marked paid"); load(); };

  const dl = async (path, name) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  };

  const saveAdv = async () => {
    try { await api.post("/advances", { ...adv, amount: Number(adv.amount), monthly_recovery: Number(adv.monthly_recovery || 0) }); toast.success("Advance recorded"); setAdvOpen(false); setAdv({ employee_id: "", amount: "", reason: "", monthly_recovery: "" }); }
    catch (e) { toast.error(apiError(e)); }
  };
  const saveAdj = async () => {
    try { await api.post("/adjustments", { ...adj, month, amount: Number(adj.amount) }); toast.success("Adjustment added — re-run payroll to apply"); setAdjOpen(false); setAdj({ employee_id: "", type: "bonus", amount: "", note: "" }); }
    catch (e) { toast.error(apiError(e)); }
  };

  const total = slips.reduce((s, x) => s + x.net, 0);
  const paidCount = slips.filter((x) => x.paid).length;

  return (
    <div>
      <PageHeader title="Payroll" subtitle="Run monthly payroll, generate payslips and record payments"
        action={<div className="flex gap-2">
          <Button variant="outline" onClick={() => setAdvOpen(true)} data-testid="add-advance-btn"><HandCoins size={16} className="mr-2" />Advance</Button>
          <Button variant="outline" onClick={() => setAdjOpen(true)} data-testid="add-adjustment-btn"><Plus size={16} className="mr-2" />Bonus</Button>
        </div>} />

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" data-testid="payroll-month" />
            <div className="text-sm text-slate-500">Net payable: <Money value={total} className="font-semibold text-slate-800" /></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={run} disabled={running} className="bg-emerald-600 hover:bg-emerald-700" data-testid="run-payroll-button">
              {running ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Play size={16} className="mr-2" />}Run Payroll
            </Button>
          </div>
        </div>
      </Card>

      {loading ? <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-emerald-600" /></div>
        : slips.length === 0 ? <EmptyState icon={Wallet} title={`No payroll for ${monthLabel(month)}`} hint="Click Run Payroll to generate payslips for all active staff." action={<Button onClick={run} className="bg-emerald-600 hover:bg-emerald-700">Run Payroll</Button>} />
        : (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 p-3 text-sm">
            <span className="text-slate-500">{slips.length} payslips · {paidCount} paid</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => dl(`/reports/salary/csv?month=${month}`, `salary_${month}.csv`)} data-testid="export-salary-btn"><Download size={14} className="mr-1" />Salary Register</Button>
              {paidCount < slips.length && <Button size="sm" onClick={payAll} className="bg-emerald-600 hover:bg-emerald-700" data-testid="pay-all-btn"><CheckCircle2 size={14} className="mr-1" />Mark All Paid</Button>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="payslip-table">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Gross</th><th className="px-4 py-3 hidden sm:table-cell">Deductions</th><th className="px-4 py-3">Net</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slips.map((s) => (
                  <tr key={s.id} className="hover:bg-emerald-50/30" data-testid={`payslip-${s.id}`}>
                    <td className="px-4 py-3 font-medium text-slate-800">{s.employee_name}</td>
                    <td className="px-4 py-3 font-mono">{inr(s.gross)}</td>
                    <td className="px-4 py-3 font-mono hidden sm:table-cell text-rose-600">-{inr(s.total_deductions)}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{inr(s.net)}</td>
                    <td className="px-4 py-3">{s.paid ? <span className="text-emerald-600 text-xs font-medium">✓ Paid</span> : <span className="text-amber-600 text-xs font-medium">Unpaid</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setView(s)} data-testid={`view-payslip-${s.id}`}><FileText size={15} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => dl(`/payslips/${s.id}/pdf`, `payslip_${s.employee_name}_${s.month}.pdf`)} data-testid={`download-payslip-pdf-button-${s.id}`}><Download size={15} /></Button>
                        {!s.paid && <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => pay(s.id)} data-testid={`pay-${s.id}`}><CheckCircle2 size={15} /></Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <PayslipDialog slip={view} onClose={() => setView(null)} onDownload={dl} />

      {/* Advance dialog */}
      <Dialog open={advOpen} onOpenChange={setAdvOpen}>
        <DialogContent><DialogHeader><DialogTitle>Record Salary Advance</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <EmpSelect emps={emps} value={adv.employee_id} onChange={(v) => setAdv({ ...adv, employee_id: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Amount"><Input type="number" value={adv.amount} onChange={(e) => setAdv({ ...adv, amount: e.target.value })} data-testid="advance-amount" /></Fld>
              <Fld label="Monthly recovery"><Input type="number" value={adv.monthly_recovery} onChange={(e) => setAdv({ ...adv, monthly_recovery: e.target.value })} /></Fld>
            </div>
            <Fld label="Reason"><Input value={adv.reason} onChange={(e) => setAdv({ ...adv, reason: e.target.value })} /></Fld>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdvOpen(false)}>Cancel</Button><Button onClick={saveAdv} disabled={!adv.employee_id} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-advance-btn">Record</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment dialog */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent><DialogHeader><DialogTitle>Bonus / Adjustment · {monthLabel(month)}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <EmpSelect emps={emps} value={adj.employee_id} onChange={(v) => setAdj({ ...adj, employee_id: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Type">
                <Select value={adj.type} onValueChange={(v) => setAdj({ ...adj, type: v })}>
                  <SelectTrigger data-testid="adjustment-type"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="bonus">Bonus (add)</SelectItem><SelectItem value="deduction">Deduction</SelectItem></SelectContent>
                </Select>
              </Fld>
              <Fld label="Amount"><Input type="number" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} data-testid="adjustment-amount" /></Fld>
            </div>
            <Fld label="Note"><Input value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} /></Fld>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdjOpen(false)}>Cancel</Button><Button onClick={saveAdj} disabled={!adj.employee_id} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-adjustment-btn">Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Fld = ({ label, children }) => <div className="space-y-1.5"><Label className="text-xs text-slate-600">{label}</Label>{children}</div>;
const EmpSelect = ({ emps, value, onChange }) => (
  <Fld label="Employee">
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid="select-employee"><SelectValue placeholder="Choose employee" /></SelectTrigger>
      <SelectContent>{emps.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
    </Select>
  </Fld>
);

export function PayslipDialog({ slip, onClose, onDownload }) {
  if (!slip) return null;
  const e = slip.earnings, d = slip.deductions;
  const rows = (obj) => Object.entries(obj).filter(([, v]) => v).map(([k, v]) => [k.replace(/_/g, " "), v]);
  return (
    <Dialog open={!!slip} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" data-testid="payslip-preview">
        <DialogHeader><DialogTitle>Payslip · {monthLabel(slip.month)}</DialogTitle></DialogHeader>
        <div className="rounded-xl border border-slate-200">
          <div className="border-b border-slate-100 p-3">
            <div className="font-semibold text-slate-800">{slip.employee_name}</div>
            <div className="text-xs text-slate-500">Paid days {slip.present_days} · LOP {slip.lop_days}</div>
          </div>
          <div className="grid grid-cols-2 gap-4 p-3 text-sm">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-emerald-600">Earnings</p>
              {rows(e).map(([k, v]) => <Row key={k} k={k} v={v} />)}
              <Row k="Gross" v={slip.gross} bold />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-rose-600">Deductions</p>
              {rows(d).length ? rows(d).map(([k, v]) => <Row key={k} k={k} v={v} />) : <div className="text-xs text-slate-400">None</div>}
              <Row k="Total" v={slip.total_deductions} bold />
            </div>
          </div>
          <div className="flex items-center justify-between bg-emerald-50 p-3">
            <span className="font-semibold text-emerald-800">Net Payable</span>
            <span className="font-mono text-lg font-bold text-emerald-800">{inr(slip.net)}</span>
          </div>
          <div className="p-3 text-xs text-slate-500">{slip.net_in_words}</div>
        </div>
        <DialogFooter>
          <Button onClick={() => onDownload(`/payslips/${slip.id}/pdf`, `payslip_${slip.employee_name}_${slip.month}.pdf`)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="dialog-download-pdf">
            <Download size={16} className="mr-2" />Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
const Row = ({ k, v, bold }) => <div className={`flex justify-between py-0.5 capitalize ${bold ? "border-t border-slate-100 mt-1 pt-1 font-semibold" : ""}`}><span className="text-slate-500">{k}</span><span className="font-mono">{inr(v)}</span></div>;
