import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { PageHeader, Card, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Clock, Plus, Trash2, MapPin, Zap } from "lucide-react";

export default function Automation() {
  return (
    <div>
      <PageHeader title="Shifts & Automation" subtitle="Reusable shift templates, payroll rules and site geofences" />
      <Tabs defaultValue="shifts">
        <TabsList><TabsTrigger value="shifts" data-testid="tab-shifts">Shifts</TabsTrigger><TabsTrigger value="rules" data-testid="tab-rules">Automation Rules</TabsTrigger><TabsTrigger value="geo" data-testid="tab-geofences">Geofences</TabsTrigger></TabsList>
        <TabsContent value="shifts" className="mt-4"><Shifts /></TabsContent>
        <TabsContent value="rules" className="mt-4"><Rules /></TabsContent>
        <TabsContent value="geo" className="mt-4"><Geofences /></TabsContent>
      </Tabs>
    </div>
  );
}

const Fld = ({ label, children }) => <div className="space-y-1.5"><Label className="text-xs text-slate-600">{label}</Label>{children}</div>;

function Shifts() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", start_time: "09:00", end_time: "18:00", working_hours: 8, week_offs: ["Sunday"] });
  const load = () => api.get("/shifts").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);
  const save = async () => {
    try { await api.post("/shifts", { ...f, working_hours: Number(f.working_hours) }); toast.success("Shift created"); setOpen(false); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { await api.delete(`/shifts/${id}`); load(); toast.success("Deleted"); };
  return (
    <>
      <div className="mb-3 flex justify-end"><Button onClick={() => setOpen(true)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-shift-btn"><Plus size={16} className="mr-2" />New Shift</Button></div>
      {rows.length === 0 ? <EmptyState icon={Clock} title="No shifts yet" hint="Create a shift template and assign it to staff." />
        : <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((s) => (
            <Card key={s.id} className="p-4" data-testid={`shift-${s.id}`}>
              <div className="flex items-start justify-between">
                <div><div className="font-semibold text-slate-800">{s.name}</div>
                  <div className="mt-1 text-sm text-slate-500">{s.start_time} – {s.end_time} · {s.working_hours}h</div>
                  <div className="mt-1 text-xs text-slate-400">Week-off: {(s.week_offs || []).join(", ") || "None"}</div></div>
                <button onClick={() => del(s.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
              </div>
            </Card>
          ))}
        </div>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New Shift</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Fld label="Shift name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="shift-name" placeholder="e.g. Morning Shift" /></Fld>
            <div className="grid grid-cols-3 gap-3">
              <Fld label="Start"><Input type="time" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></Fld>
              <Fld label="End"><Input type="time" value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} /></Fld>
              <Fld label="Hours"><Input type="number" value={f.working_hours} onChange={(e) => setF({ ...f, working_hours: e.target.value })} /></Fld>
            </div>
            <Fld label="Weekly off">
              <Select value={f.week_offs[0]} onValueChange={(v) => setF({ ...f, week_offs: [v] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Sunday", "Saturday", "Monday", "None"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </Fld>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-shift-btn">Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const RULE_META = [
  ["late_entry", "Late Entry", "Fine when staff clock in after grace period"],
  ["early_exit", "Early Exit", "Fine when staff leave before shift end"],
  ["overtime", "Overtime", "Pay for hours beyond shift end"],
  ["early_overtime", "Early Overtime", "Pay for hours before shift start"],
];

function Rules() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cfg, setCfg] = useState({
    late_entry: { enabled: true, grace_minutes: 15, mode: "multiplier", multiplier: 1, amount: 0 },
    early_exit: { enabled: false, mode: "multiplier", multiplier: 1, amount: 0 },
    overtime: { enabled: true, multiplier: 1.5, daily_cap_hours: 3 },
    early_overtime: { enabled: false, multiplier: 1.5 },
    break_rule: { enabled: false, allowed_minutes: 60 },
  });
  const load = () => api.get("/rule-sets").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);
  const save = async () => {
    try { await api.post("/rule-sets", { name, ...cfg }); toast.success("Rule set saved"); setOpen(false); setName(""); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { await api.delete(`/rule-sets/${id}`); load(); };
  const upd = (key, k, v) => setCfg((p) => ({ ...p, [key]: { ...p[key], [k]: v } }));
  return (
    <>
      <div className="mb-3 flex justify-end"><Button onClick={() => setOpen(true)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-ruleset-btn"><Plus size={16} className="mr-2" />New Rule Set</Button></div>
      {rows.length === 0 ? <EmptyState icon={Zap} title="No automation rules" hint="Create reusable rule sets for late fines & overtime." />
        : <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id} className="p-4" data-testid={`ruleset-${r.id}`}>
              <div className="flex items-start justify-between">
                <div className="font-semibold text-slate-800">{r.name}</div>
                <button onClick={() => del(r.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-slate-500">
                {RULE_META.map(([k, label]) => r[k]?.enabled && <li key={k}>✓ {label}{r[k].multiplier ? ` ×${r[k].multiplier}` : ""}{r[k].grace_minutes != null ? ` (grace ${r[k].grace_minutes}m)` : ""}</li>)}
              </ul>
            </Card>
          ))}
        </div>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>New Rule Set</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Fld label="Rule set name"><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="ruleset-name" placeholder="e.g. Factory Rules" /></Fld>
            {RULE_META.map(([key, label, desc]) => (
              <div key={key} className="rounded-xl border border-slate-200 p-3">
                <label className="flex items-center justify-between">
                  <div><div className="text-sm font-medium">{label}</div><div className="text-xs text-slate-400">{desc}</div></div>
                  <Switch checked={cfg[key].enabled} onCheckedChange={(v) => upd(key, "enabled", v)} data-testid={`rule-${key}-toggle`} />
                </label>
                {cfg[key].enabled && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {key === "late_entry" && <Fld label="Grace (min)"><Input type="number" value={cfg[key].grace_minutes} onChange={(e) => upd(key, "grace_minutes", Number(e.target.value))} /></Fld>}
                    {(key === "overtime" || key === "early_overtime") ? (
                      <Fld label="Multiplier"><Input type="number" step="0.1" value={cfg[key].multiplier} onChange={(e) => upd(key, "multiplier", Number(e.target.value))} /></Fld>
                    ) : (
                      <Fld label="Multiplier"><Input type="number" step="0.1" value={cfg[key].multiplier} onChange={(e) => upd(key, "multiplier", Number(e.target.value))} /></Fld>
                    )}
                    {key === "overtime" && <Fld label="Daily cap (h)"><Input type="number" value={cfg[key].daily_cap_hours} onChange={(e) => upd(key, "daily_cap_hours", Number(e.target.value))} /></Fld>}
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-ruleset-btn">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Geofences() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", lat: "", lng: "", radius: 150 });
  const load = () => api.get("/geofences").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);
  const useCurrent = () => navigator.geolocation?.getCurrentPosition((p) => setF((s) => ({ ...s, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })));
  const save = async () => {
    try { await api.post("/geofences", { name: f.name, lat: Number(f.lat), lng: Number(f.lng), radius: Number(f.radius) }); toast.success("Geofence added"); setOpen(false); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { await api.delete(`/geofences/${id}`); load(); };
  return (
    <>
      <div className="mb-3 flex justify-end"><Button onClick={() => setOpen(true)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-geofence-btn"><Plus size={16} className="mr-2" />New Geofence</Button></div>
      {rows.length === 0 ? <EmptyState icon={MapPin} title="No geofences" hint="Add office/site locations to validate punch GPS." />
        : <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((g) => (
            <Card key={g.id} className="p-4" data-testid={`geofence-${g.id}`}>
              <div className="flex items-start justify-between">
                <div><div className="font-semibold text-slate-800">{g.name}</div>
                  <div className="mt-1 text-xs text-slate-500 font-mono">{g.lat.toFixed(4)}, {g.lng.toFixed(4)}</div>
                  <div className="text-xs text-slate-400">Radius {g.radius}m</div></div>
                <button onClick={() => del(g.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
              </div>
            </Card>
          ))}
        </div>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New Geofence</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Fld label="Site name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="geofence-name" placeholder="e.g. Head Office" /></Fld>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Latitude"><Input value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} /></Fld>
              <Fld label="Longitude"><Input value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} /></Fld>
            </div>
            <Fld label="Radius (metres)"><Input type="number" value={f.radius} onChange={(e) => setF({ ...f, radius: e.target.value })} /></Fld>
            <Button variant="outline" className="w-full" onClick={useCurrent}><MapPin size={16} className="mr-2" />Use my current location</Button>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-geofence-btn">Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
