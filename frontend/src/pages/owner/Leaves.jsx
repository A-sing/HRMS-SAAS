import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { PageHeader, Card, EmptyState, Pill } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LEAVE_STATUS, prettyDate } from "@/lib/format";
import { Check, X, CalendarDays, Loader2 } from "lucide-react";

export default function Leaves() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/leaves", { params: { status: filter === "all" ? undefined : filter } });
    setRows(data); setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const decide = async (id, decision) => {
    try { await api.post(`/leaves/${id}/decision`, { decision }); toast.success(`Leave ${decision}`); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div>
      <PageHeader title="Leave Requests" subtitle="Approve or reject staff leave applications" />
      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList>
          <TabsTrigger value="pending" data-testid="leave-filter-pending">Pending</TabsTrigger>
          <TabsTrigger value="approved" data-testid="leave-filter-approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="leave-filter-rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all" data-testid="leave-filter-all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      {loading ? <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-emerald-600" /></div>
        : rows.length === 0 ? <EmptyState icon={CalendarDays} title="No leave requests" hint="Requests from employees appear here." />
        : <div className="space-y-3">
          {rows.map((l) => (
            <Card key={l.id} className="p-4" data-testid={`leave-${l.id}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{l.employee_name}</span>
                    <Pill className="bg-slate-100 text-slate-600 border-slate-200 capitalize">{l.type}</Pill>
                    <Pill className={LEAVE_STATUS[l.status]}>{l.status}</Pill>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{prettyDate(l.from_date)} → {prettyDate(l.to_date)} · {l.days} day(s)</div>
                  {l.reason && <div className="mt-1 text-xs text-slate-400">“{l.reason}”</div>}
                </div>
                {l.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decide(l.id, "approved")} className="bg-emerald-600 hover:bg-emerald-700" data-testid={`leave-approve-${l.id}`}><Check size={16} className="mr-1" />Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => decide(l.id, "rejected")} className="text-rose-600" data-testid={`leave-reject-${l.id}`}><X size={16} className="mr-1" />Reject</Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>}
    </div>
  );
}
