import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Card } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Percent, CalendarDays, Save, Plus, Trash2 } from "lucide-react";

export default function Settings() {
  const { company, loadCompany } = useAuth();
  const [c, setC] = useState(null);

  useEffect(() => { if (company) setC(JSON.parse(JSON.stringify(company))); }, [company]);
  if (!c) return null;

  const saveCompany = async () => {
    try {
      await api.put("/company", { name: c.name, gstin: c.gstin, address: c.address, settings: c.settings, leave_types: c.leave_types });
      toast.success("Settings saved"); loadCompany();
    } catch (e) { toast.error(apiError(e)); }
  };
  const setSetting = (k, v) => setC((p) => ({ ...p, settings: { ...p.settings, [k]: Number(v) } }));
  const setLeave = (i, k, v) => setC((p) => { const lt = [...p.leave_types]; lt[i] = { ...lt[i], [k]: k === "annual" ? Number(v) : v }; return { ...p, leave_types: lt }; });
  const addLeave = () => setC((p) => ({ ...p, leave_types: [...p.leave_types, { code: `leave${p.leave_types.length + 1}`, name: "New Leave", annual: 6 }] }));
  const delLeave = (i) => setC((p) => ({ ...p, leave_types: p.leave_types.filter((_, x) => x !== i) }));

  const Fld = ({ label, children }) => <div className="space-y-1.5"><Label className="text-xs text-slate-600">{label}</Label>{children}</div>;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Company profile, statutory rates and leave policy"
        action={<Button onClick={saveCompany} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-settings-btn"><Save size={16} className="mr-2" />Save</Button>} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800"><Building2 size={18} className="text-emerald-600" />Company Profile</h3>
          <div className="space-y-3">
            <Fld label="Company name"><Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} data-testid="company-name-input" /></Fld>
            <Fld label="GSTIN"><Input value={c.gstin || ""} onChange={(e) => setC({ ...c, gstin: e.target.value })} /></Fld>
            <Fld label="Address"><Input value={c.address || ""} onChange={(e) => setC({ ...c, address: e.target.value })} /></Fld>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800"><Percent size={18} className="text-emerald-600" />Statutory Rates (India)</h3>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="PF rate %"><Input type="number" value={c.settings.pf_rate} onChange={(e) => setSetting("pf_rate", e.target.value)} data-testid="pf-rate" /></Fld>
            <Fld label="PF wage cap"><Input type="number" value={c.settings.pf_wage_cap} onChange={(e) => setSetting("pf_wage_cap", e.target.value)} /></Fld>
            <Fld label="ESI rate %"><Input type="number" step="0.01" value={c.settings.esi_rate} onChange={(e) => setSetting("esi_rate", e.target.value)} /></Fld>
            <Fld label="ESI threshold"><Input type="number" value={c.settings.esi_threshold} onChange={(e) => setSetting("esi_threshold", e.target.value)} /></Fld>
            <Fld label="PT (high slab)"><Input type="number" value={c.settings.pt_high} onChange={(e) => setSetting("pt_high", e.target.value)} /></Fld>
            <Fld label="PT (mid slab)"><Input type="number" value={c.settings.pt_mid} onChange={(e) => setSetting("pt_mid", e.target.value)} /></Fld>
          </div>
          <p className="mt-3 text-xs text-slate-400">Working calculator using standard India rates. Not a certified e-filing tool.</p>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-slate-800"><CalendarDays size={18} className="text-emerald-600" />Leave Types</h3>
            <Button size="sm" variant="outline" onClick={addLeave} data-testid="add-leave-type-btn"><Plus size={14} className="mr-1" />Add</Button>
          </div>
          <div className="space-y-2">
            {c.leave_types.map((lt, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_90px_40px] items-center gap-2">
                <Input value={lt.name} onChange={(e) => setLeave(i, "name", e.target.value)} placeholder="Leave name" />
                <Input value={lt.code} onChange={(e) => setLeave(i, "code", e.target.value)} placeholder="code" />
                <Input type="number" value={lt.annual} onChange={(e) => setLeave(i, "annual", e.target.value)} />
                <button onClick={() => delLeave(i)} className="grid h-9 place-items-center text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
