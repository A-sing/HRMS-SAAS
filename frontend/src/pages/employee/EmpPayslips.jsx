import React, { useEffect, useState } from "react";
import api, { API, TOKEN_KEY } from "@/lib/api";
import { PageHeader, Card, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { inr, monthLabel } from "@/lib/format";
import { FileText, Download, Eye, Loader2 } from "lucide-react";
import { PayslipDialog } from "@/pages/owner/Payroll";

export default function EmpPayslips() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(null);

  useEffect(() => { api.get("/payslips").then((r) => { setRows(r.data); setLoading(false); }); }, []);

  const dl = async (path, name) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader title="My Payslips" subtitle="View and download your monthly payslips" />
      {loading ? <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-emerald-600" /></div>
        : rows.length === 0 ? <EmptyState icon={FileText} title="No payslips yet" hint="Payslips appear here once payroll is run." />
        : <div className="space-y-3">
          {rows.map((s) => (
            <Card key={s.id} className="flex items-center justify-between p-4" data-testid={`emp-payslip-${s.id}`}>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><FileText size={20} /></span>
                <div>
                  <div className="font-semibold text-slate-800">{monthLabel(s.month)}</div>
                  <div className="text-xs text-slate-500">Net <b className="font-mono">{inr(s.net)}</b> · {s.paid ? <span className="text-emerald-600">Paid</span> : <span className="text-amber-600">Pending</span>}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setView(s)} data-testid={`emp-view-payslip-${s.id}`}><Eye size={16} /></Button>
                <Button size="sm" variant="ghost" onClick={() => dl(`/payslips/${s.id}/pdf`, `payslip_${s.month}.pdf`)} data-testid={`emp-download-payslip-${s.id}`}><Download size={16} /></Button>
              </div>
            </Card>
          ))}
        </div>}
      <PayslipDialog slip={view} onClose={() => setView(null)} onDownload={dl} />
    </div>
  );
}
