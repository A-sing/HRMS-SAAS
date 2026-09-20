import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Users, CalendarCheck, Wallet, Settings2, Clock,
  CalendarDays, FileText, LogOut, Building2, Menu, X, IndianRupee,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const OWNER_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/directory", label: "Staff", icon: Users },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/automation", label: "Shifts & Rules", icon: Clock },
  { to: "/leaves", label: "Leaves", icon: CalendarDays },
  { to: "/payroll", label: "Payroll", icon: Wallet },
  { to: "/settings", label: "Settings", icon: Settings2 },
];

const EMP_NAV = [
  { to: "/me", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/me/attendance", label: "Check In", icon: CalendarCheck },
  { to: "/me/leaves", label: "Leaves", icon: CalendarDays },
  { to: "/me/payslips", label: "Payslips", icon: FileText },
];

export default function AppShell({ children }) {
  const { user, company, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const items = user?.role === "owner" ? OWNER_NAV : EMP_NAV;
  const initials = (user?.name || "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const NavItems = ({ onClick }) => (
    <nav className="flex flex-col gap-1">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} onClick={onClick}
          data-testid={`nav-${it.label.toLowerCase().replace(/\s+/g, "-")}`}
          className={({ isActive }) => cn(
            "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
            isActive ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
          )}>
          <it.icon size={18} /> {it.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#f6f8f9]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-slate-200 bg-white p-4">
        <Brand company={company} />
        <div className="mt-6 flex-1"><NavItems /></div>
        <UserBox user={user} logout={logout} initials={initials} />
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur px-4 py-3">
        <Brand company={company} compact />
        <button data-testid="mobile-menu-btn" onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200">
          <Menu size={20} />
        </button>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <motion.div initial={{ x: -280 }} animate={{ x: 0 }} className="absolute inset-y-0 left-0 w-72 bg-white p-4 flex flex-col">
            <div className="flex items-center justify-between">
              <Brand company={company} />
              <button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg border"><X size={18} /></button>
            </div>
            <div className="mt-6 flex-1"><NavItems onClick={() => setOpen(false)} /></div>
            <UserBox user={user} logout={logout} initials={initials} />
          </motion.div>
        </div>
      )}

      {/* Main content */}
      <main className="lg:pl-64 pb-24 lg:pb-8">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 5)}, 1fr)` }}>
          {items.slice(0, 5).map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end}
              data-testid={`bottomnav-${it.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) => cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                isActive ? "text-emerald-600" : "text-slate-500"
              )}>
              <it.icon size={20} /> {it.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Brand({ company, compact }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
        <IndianRupee size={20} />
      </div>
      <div className={cn(compact && "hidden sm:block")}>
        <div className="font-display font-bold leading-tight text-slate-900">PayMitra</div>
        <div className="text-[11px] text-slate-500 truncate max-w-[140px]">{company?.name || "HRMS & Payroll"}</div>
      </div>
    </div>
  );
}

function UserBox({ user, logout, initials }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button data-testid="user-menu-btn" className="mt-4 flex w-full items-center gap-3 rounded-xl border border-slate-200 p-2.5 text-left hover:bg-slate-50">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-sm font-semibold text-white">{initials}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-800">{user?.name}</span>
            <span className="block text-[11px] capitalize text-slate-500">{user?.role}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="px-2 py-1.5 text-xs text-slate-500 truncate">{user?.email}</div>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="logout-btn" onClick={logout} className="text-rose-600">
          <LogOut size={16} className="mr-2" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
