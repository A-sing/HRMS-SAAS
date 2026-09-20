import React, { useEffect, useRef, useState } from "react";
import api, { API, apiError, TOKEN_KEY } from "@/lib/api";
import { PageHeader, Card, EmptyState, Pill } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { inr } from "@/lib/format";
import { UserPlus, Search, Upload, Download, FileSpreadsheet, Users, Loader2, Camera } from "lucide-react";
import SelfieCapture from "@/components/SelfieCapture";

const empty = { name: "", phone: "", email: "", department: "", designation: "", doj: "", password: "",
  shift_id: "", rule_set_id: "", salary: { ctc: "", basic: "", hra: "", other: "", pf_applicable: true, esi_applicable: false } };

export default function Directory() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("active");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [rules, setRules] = useState([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importRes, setImportRes] = useState(null);
  const [faceOpen, setFaceOpen] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/employees", { params: { status: statusF || undefined, q: q || undefined } });
    setRows(data); setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusF]);
  useEffect(() => { api.get("/shifts").then((r) => setShifts(r.data)); api.get("/rule-sets").then((r) => setRules(r.data)); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (e) => {
    setEditing(e);
    setForm({ ...empty, ...e, doj: e.doj || "", shift_id: e.shift_id || "", rule_set_id: e.rule_set_id || "",
      salary: { ...empty.salary, ...e.salary } });
    setOpen(true);
  };

  const save = async () => {
    try {
      const payload = { ...form, salary: {
        ctc: Number(form.salary.ctc || 0), basic: Number(form.salary.basic || 0),
        hra: Number(form.salary.hra || 0), other: Number(form.salary.other || 0),
        pf_applicable: form.salary.pf_applicable, esi_applicable: form.salary.esi_applicable },
        shift_id: form.shift_id || null, rule_set_id: form.rule_set_id || null };
      if (editing) { await api.put(`/employees/${editing.id}`, payload); toast.success("Employee updated"); }
      else { await api.post("/employees", payload); toast.success("Employee added"); }
      setOpen(false); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const toggleStatus = async (e) => {
    await api.put(`/employees/${e.id}`, { status: e.status === "active" ? "inactive" : "active" });
    toast.success("Status updated"); load(); setDetail(null);
  };

  const dl = async (path, name) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  };

  const doImport = async (file) => {
    const fd = new FormData(); fd.append("file", file);
    const token = localStorage.getItem(TOKEN_KEY);
    try {
      const res = await fetch(`${API}/employees/import/csv`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      setImportRes(data); load();
      toast.success(`${data.created} staff imported${data.errors.length ? `, ${data.errors.length} skipped` : ""}`);
    } catch (e) { toast.error("Import failed"); }
  };

  const S = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const Sal = (k) => (e) => setForm((p) => ({ ...p, salary: { ...p.salary, [k]: e.target.value } }));

  return (
    <div>
      <PageHeader title="Staff Directory" subtitle={`${rows.length} employees`}
        action={<Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-employee-btn"><UserPlus size={16} className="mr-2" />Add Staff</Button>} />

      <Card className="p-3 sm:p-4 mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Search name, department, designation…" className="pl-9" data-testid="employee-search" />
          </div>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="w-full sm:w-40" data-testid="status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="import-csv-btn"><Upload size={16} className="mr-2" />Import</Button>
            <Button variant="outline" onClick={() => dl("/employees/export/csv", "staff_export.csv")} data-testid="export-csv-btn"><Download size={16} className="mr-2" />Export</Button>
          </div>
        </div>
      </Card>

      {loading ? <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-emerald-600" /></div>
        : rows.length === 0 ? <EmptyState icon={Users} title="No staff yet" hint="Add your first employee or import a CSV." action={<Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">Add Staff</Button>} />
        : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="employee-directory-table">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3 hidden sm:table-cell">Department</th><th className="px-4 py-3 hidden md:table-cell">Designation</th><th className="px-4 py-3">CTC</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((e) => (
                  <tr key={e.id} onClick={() => setDetail(e)} className="cursor-pointer hover:bg-emerald-50/40" data-testid={`employee-row-${e.id}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{e.name}</div>
                      <div className="text-xs text-slate-400">{e.email}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-slate-600">{e.department || "—"}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-600">{e.designation || "—"}</td>
                    <td className="px-4 py-3 font-mono">{inr(e.salary?.ctc)}</td>
                    <td className="px-4 py-3"><Pill className={e.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}>{e.status}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Name"><Input value={form.name} onChange={S("name")} data-testid="emp-name" /></Fld>
              <Fld label="Phone"><Input value={form.phone} onChange={S("phone")} data-testid="emp-phone" /></Fld>
            </div>
            <Fld label="Email"><Input type="email" value={form.email} onChange={S("email")} disabled={!!editing} data-testid="emp-email" /></Fld>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Department"><Input value={form.department} onChange={S("department")} data-testid="emp-dept" /></Fld>
              <Fld label="Designation"><Input value={form.designation} onChange={S("designation")} data-testid="emp-desig" /></Fld>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Date of Joining"><Input type="date" value={form.doj} onChange={S("doj")} data-testid="emp-doj" /></Fld>
              {!editing && <Fld label="Login Password"><Input value={form.password} onChange={S("password")} placeholder="Welcome@123" data-testid="emp-password" /></Fld>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Shift">
                <Select value={form.shift_id} onValueChange={(v) => setForm((p) => ({ ...p, shift_id: v }))}>
                  <SelectTrigger data-testid="emp-shift"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>{shifts.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </Fld>
              <Fld label="Rule Set">
                <Select value={form.rule_set_id} onValueChange={(v) => setForm((p) => ({ ...p, rule_set_id: v }))}>
                  <SelectTrigger data-testid="emp-ruleset"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>{rules.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </Fld>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Salary Structure (monthly)</p>
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Monthly CTC"><Input type="number" value={form.salary.ctc} onChange={Sal("ctc")} data-testid="emp-ctc" /></Fld>
                <Fld label="Basic"><Input type="number" value={form.salary.basic} onChange={Sal("basic")} data-testid="emp-basic" /></Fld>
                <Fld label="HRA"><Input type="number" value={form.salary.hra} onChange={Sal("hra")} /></Fld>
                <Fld label="Other Allowances"><Input type="number" value={form.salary.other} onChange={Sal("other")} /></Fld>
              </div>
              <div className="mt-3 flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.salary.pf_applicable} onCheckedChange={(v) => setForm((p) => ({ ...p, salary: { ...p.salary, pf_applicable: v } }))} data-testid="emp-pf" />PF Applicable</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.salary.esi_applicable} onCheckedChange={(v) => setForm((p) => ({ ...p, salary: { ...p.salary, esi_applicable: v } }))} data-testid="emp-esi" />ESI Applicable</label>
              </div>
            </div>
            {editing && (
              <Button variant="outline" className="w-full" onClick={() => setFaceOpen(true)} data-testid="register-face-btn">
                <Camera size={16} className="mr-2" />{form.reference_face ? "Re-register face photo" : "Register reference face"}
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-employee-btn">{editing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Face register */}
      <Dialog open={faceOpen} onOpenChange={setFaceOpen}>
        <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Register Reference Face</DialogTitle></DialogHeader>
          <SelfieCapture referenceFace={null} actionLabel="Save Face" onCancel={() => setFaceOpen(false)}
            onCapture={({ selfie }) => { setForm((p) => ({ ...p, reference_face: selfie })); setFaceOpen(false); toast.success("Face captured — save employee to store it"); }} />
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) setImportRes(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Bulk Import Staff</DialogTitle>
            <DialogDescription>Upload a CSV using our template. Bad rows are reported so you can fix & re-upload.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Button variant="outline" className="w-full" onClick={() => dl("/employees/template/csv", "staff_template.csv")} data-testid="download-template-btn">
              <FileSpreadsheet size={16} className="mr-2" />Download CSV Template
            </Button>
            <div onClick={() => fileRef.current?.click()} data-testid="employee-csv-upload-dropzone"
              className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-emerald-400 hover:bg-emerald-50/30">
              <Upload className="mx-auto mb-2 text-slate-400" />
              <p className="text-sm font-medium text-slate-600">Click to choose CSV file</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files[0] && doImport(e.target.files[0])} />
            {importRes && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="text-emerald-700 font-medium">{importRes.created} created</p>
                {importRes.errors?.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto">
                    <p className="text-rose-600 font-medium">{importRes.errors.length} rows skipped:</p>
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                      {importRes.errors.map((er, i) => <li key={i}>Row {er.row}: {er.error}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail sheet */}
      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent className="overflow-y-auto">
          {detail && (
            <>
              <SheetHeader><SheetTitle>{detail.name}</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <Info k="Email" v={detail.email} /><Info k="Phone" v={detail.phone || "—"} />
                <Info k="Department" v={detail.department || "—"} /><Info k="Designation" v={detail.designation || "—"} />
                <Info k="Date of Joining" v={detail.doj || "—"} />
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Salary</p>
                  <Info k="CTC" v={inr(detail.salary?.ctc)} /><Info k="Basic" v={inr(detail.salary?.basic)} />
                  <Info k="HRA" v={inr(detail.salary?.hra)} /><Info k="Other" v={inr(detail.salary?.other)} />
                  <Info k="PF / ESI" v={`${detail.salary?.pf_applicable ? "PF" : "—"} / ${detail.salary?.esi_applicable ? "ESI" : "—"}`} />
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Leave Balances</p>
                  {Object.entries(detail.leave_balances || {}).map(([k, v]) => <Info key={k} k={k} v={`${v} days`} />)}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setDetail(null); openEdit(detail); }} data-testid="edit-employee-btn">Edit</Button>
                  <Button variant="outline" className="flex-1 text-rose-600" onClick={() => toggleStatus(detail)} data-testid="toggle-status-btn">
                    {detail.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

const Fld = ({ label, children }) => <div className="space-y-1.5"><Label className="text-xs text-slate-600">{label}</Label>{children}</div>;
const Info = ({ k, v }) => <div className="flex items-center justify-between py-0.5"><span className="capitalize text-slate-500">{k}</span><span className="font-medium text-slate-800">{v}</span></div>;
