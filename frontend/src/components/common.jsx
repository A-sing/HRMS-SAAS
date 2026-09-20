import React from "react";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/format";
import { motion } from "framer-motion";

export function Money({ value, className }) {
  return <span className={cn("font-mono tabular-nums", className)}>{inr(value)}</span>;
}

export function Pill({ children, className }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900" data-testid="page-title">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, accent = "emerald", testid, sub }) {
  const accents = {
    emerald: "from-emerald-500 to-teal-600 text-emerald-600 bg-emerald-50",
    blue: "from-blue-500 to-indigo-600 text-blue-600 bg-blue-50",
    amber: "from-amber-500 to-orange-600 text-amber-600 bg-amber-50",
    rose: "from-rose-500 to-pink-600 text-rose-600 bg-rose-50",
    slate: "from-slate-700 to-slate-900 text-slate-700 bg-slate-100",
  };
  const [, , textCls, bgCls] = (accents[accent] || accents.emerald).split(" ");
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }} transition={{ duration: 0.25 }}
      data-testid={testid}
      className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        {Icon && <span className={cn("grid h-9 w-9 place-items-center rounded-xl", bgCls, textCls)}><Icon size={18} /></span>}
      </div>
      <div className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 font-display">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </motion.div>
  );
}

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
      {Icon && <Icon className="mx-auto mb-3 text-slate-400" size={34} />}
      <p className="font-semibold text-slate-700">{title}</p>
      {hint && <p className="text-sm text-slate-500 mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Card({ children, className }) {
  return <div className={cn("rounded-2xl border border-slate-200/80 bg-white shadow-sm", className)}>{children}</div>;
}
