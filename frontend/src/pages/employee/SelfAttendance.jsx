import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { PageHeader, Card, Pill } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ATT_STATUS, prettyTime, prettyDate } from "@/lib/format";
import { LogIn, LogOut, MapPin, Camera, Loader2, CheckCircle2 } from "lucide-react";
import SelfieCapture from "@/components/SelfieCapture";

export default function SelfAttendance() {
  const [me, setMe] = useState(null);
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("in");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: dash }, { data: att }] = await Promise.all([
      api.get("/dashboard/employee"),
      api.get("/attendance", { params: { month: new Date().toISOString().slice(0, 7) } }),
    ]);
    setMe(dash.employee); setToday(dash.today);
    setHistory(att.sort((a, b) => b.date.localeCompare(a.date)));
  };
  useEffect(() => { load(); }, []);

  const startPunch = (k) => { setKind(k); setOpen(true); };

  const doPunch = async ({ selfie, lat, lng, face_match }) => {
    setBusy(true);
    try {
      await api.post("/attendance/punch", { kind, selfie, lat, lng, face_match });
      toast.success(kind === "in" ? "Checked in!" : "Checked out!");
      setOpen(false); load();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  const checkedIn = today?.check_in && !today?.check_out;
  const doneToday = today?.check_in && today?.check_out;

  return (
    <div>
      <PageHeader title="Self Check-in" subtitle="Punch in and out with a selfie and location" />

      <Card className="mb-4 overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-center text-white">
          <ClockNow />
          <div className="mt-3 flex items-center justify-center gap-4 text-sm text-emerald-100">
            <span>In: <b className="text-white">{today?.check_in ? prettyTime(today.check_in) : "—"}</b></span>
            <span>Out: <b className="text-white">{today?.check_out ? prettyTime(today.check_out) : "—"}</b></span>
          </div>
          {today?.geofence_in && <Pill className="mt-3 border-white/30 bg-white/15 text-white"><MapPin size={11} />{today.geofence_in === "inside" ? "Inside Office Geofence" : today.geofence_in}</Pill>}
        </div>
        <div className="p-4">
          {doneToday ? (
            <div className="flex items-center justify-center gap-2 py-3 text-emerald-600"><CheckCircle2 size={20} />Attendance complete for today</div>
          ) : (
            <Button onClick={() => startPunch(checkedIn ? "out" : "in")} disabled={busy}
              className="h-14 w-full bg-emerald-600 text-lg hover:bg-emerald-700" data-testid="punch-in-button">
              {checkedIn ? <><LogOut size={20} className="mr-2" />Check Out</> : <><LogIn size={20} className="mr-2" />Check In</>}
            </Button>
          )}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400"><Camera size={13} />Selfie + GPS captured with each punch</p>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 text-xs font-semibold uppercase text-slate-500">This month</div>
        <div className="space-y-2">
          {history.length === 0 && <div className="py-6 text-center text-sm text-slate-400">No records yet</div>}
          {history.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3" data-testid={`emp-att-${r.date}`}>
              <div>
                <div className="text-sm font-medium text-slate-700">{prettyDate(r.date)}</div>
                <div className="text-xs text-slate-400">{r.check_in ? prettyTime(r.check_in) : "—"} → {r.check_out ? prettyTime(r.check_out) : "—"}</div>
              </div>
              <Pill className={(ATT_STATUS[r.status] || ATT_STATUS.present).cls}>{(ATT_STATUS[r.status] || {}).label || r.status}</Pill>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{kind === "in" ? "Check In" : "Check Out"} Selfie</DialogTitle></DialogHeader>
          {busy ? <div className="grid h-64 place-items-center"><Loader2 className="animate-spin text-emerald-600" /></div>
            : <SelfieCapture referenceFace={me?.reference_face || null} actionLabel={kind === "in" ? "Confirm Check In" : "Confirm Check Out"}
                onCancel={() => setOpen(false)} onCapture={doPunch} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClockNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return <div className="font-display text-4xl font-bold tabular-nums" data-testid="live-clock">{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>;
}
