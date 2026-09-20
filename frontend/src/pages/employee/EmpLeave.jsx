import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Card, EmptyState, Pill } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { LEAVE_STATUS, prettyDate } from "@/lib/format";
import { CalendarDays, Plus, Loader2 } from "lucide-react";

export default function EmpLeave() {
  const { company } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ type: "casual", from_date: "", to_date: "", reason: "" });
  const types = company?.leave_types || [{ code: "casual", name: "Casual Leave" }];

  const load = async () => { setLoading(true); const { data } = await api.get("/leaves"); setRows(data); setLoading(false); };
  useEffect(() => { load(); }, []);

  const apply = async () => {
    try { await api.post("/leaves", f); toast.success("Leave applied"); setOpen(false); setF({ type: "casual", from_date: "", to_date: "", reason: "" }); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div>
      <PageHeader title="My Leaves" subtitle="Apply for leave and track approvals"
        action={<Button onClick={() => setOpen(true)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="apply-leave-btn"><Plus size={16} className="mr-2" />Apply</Button>} />

      {loading ? <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-emerald-600" /></div>
        : rows.length === 0 ? <EmptyState icon={CalendarDays} title="No leave applications" hint="Tap Apply to request time off." />
        : <div className="space-y-3">
          {rows.map((l) => (
            <Card key={l.id} className="p-4" data-testid={`emp-leave-${l.id}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize text-slate-800">{l.type}</span>
                    <Pill className={LEAVE_STATUS[l.status]}>{l.status}</Pill>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{prettyDate(l.from_date)} → {prettyDate(l.to_date)} · {l.days} day(s)</div>
                  {l.reason && <div className="mt-1 text-xs text-slate-400">“{l.reason}”</div>}
                </div>
              </div>
            </Card>
          ))}
        </div>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs text-slate-600">Leave type</Label>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
                <SelectTrigger data-testid="leave-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>{types.map((t) => <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs text-slate-600">From</Label><Input type="date" value={f.from_date} onChange={(e) => setF({ ...f, from_date: e.target.value })} data-testid="leave-from" /></div>
              <div className="space-y-1.5"><Label className="text-xs text-slate-600">To</Label><Input type="date" value={f.to_date} onChange={(e) => setF({ ...f, to_date: e.target.value })} data-testid="leave-to" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-600">Reason</Label><Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} data-testid="leave-reason" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={apply} disabled={!f.from_date || !f.to_date} className="bg-emerald-600 hover:bg-emerald-700" data-testid="submit-leave-btn">Apply</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
