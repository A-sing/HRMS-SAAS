import React, { useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { IndianRupee, Loader2, ShieldCheck, Users, CalendarCheck, Wallet } from "lucide-react";

export default function Login() {
  const { applyAuth } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({ email: "", password: "", name: "", company_name: "", gstin: "", address: "" });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const go = (user) => nav(user.role === "owner" ? "/dashboard" : "/me", { replace: true });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { data } = await api.post("/auth/login", { email: f.email, password: f.password });
        applyAuth(data); go(data.user);
      } else {
        const { data } = await api.post("/auth/register", {
          name: f.name, email: f.email, password: f.password,
          company_name: f.company_name, gstin: f.gstin, address: f.address,
        });
        applyAuth(data); toast.success("Company created! Welcome to PayMitra."); go(data.user);
      }
    } catch (err) {
      toast.error(apiError(err));
    } finally { setLoading(false); }
  };

  const google = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const demo = (email) => { setMode("login"); setF((p) => ({ ...p, email, password: email.includes("gmail") ? "Owner@12345" : "Welcome@123" })); };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600"><IndianRupee /></div>
          <span className="text-xl font-bold font-display">PayMitra</span>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight font-display">Staff attendance & payroll,<br />made effortless.</h1>
          <p className="mt-4 max-w-md text-slate-300">Run attendance, leaves, shifts, statutory payroll and payslips for your whole team — from your phone or desktop.</p>
          <div className="mt-8 space-y-3">
            {[[Users, "Employee directory with bulk CSV import"], [CalendarCheck, "Selfie + GPS self check-in & geofencing"], [Wallet, "One-click payroll with PF, ESI, PT & TDS"]].map(([Ic, t], i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-slate-200"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><Ic size={16} /></span>{t}</div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-slate-400 flex items-center gap-2"><ShieldCheck size={14} /> India statutory-ready · INR · Multi-company SaaS</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center bg-[#f6f8f9] p-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="mb-6 lg:hidden flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white"><IndianRupee size={20} /></div>
            <span className="text-lg font-bold font-display">PayMitra</span>
          </div>
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" data-testid="login-tab">Log in</TabsTrigger>
              <TabsTrigger value="register" data-testid="register-tab">Create company</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <h2 className="mt-5 text-xl font-bold">Welcome back</h2>
              <p className="text-sm text-slate-500">Log in as owner or employee.</p>
            </TabsContent>
            <TabsContent value="register">
              <h2 className="mt-5 text-xl font-bold">Set up your business</h2>
              <p className="text-sm text-slate-500">Create an owner account & company workspace.</p>
            </TabsContent>

            <form onSubmit={submit} className="mt-5 space-y-3.5">
              {mode === "register" && (
                <>
                  <Field label="Your name"><Input required value={f.name} onChange={set("name")} data-testid="reg-name" placeholder="e.g. Ramesh Kumar" /></Field>
                  <Field label="Company name"><Input required value={f.company_name} onChange={set("company_name")} data-testid="reg-company" placeholder="e.g. Bharat Textiles Pvt Ltd" /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="GSTIN (optional)"><Input value={f.gstin} onChange={set("gstin")} data-testid="reg-gstin" /></Field>
                    <Field label="City / Address"><Input value={f.address} onChange={set("address")} data-testid="reg-address" /></Field>
                  </div>
                </>
              )}
              <Field label="Email"><Input type="email" required value={f.email} onChange={set("email")} data-testid="email-input" placeholder="you@company.com" /></Field>
              <Field label="Password"><Input type="password" required value={f.password} onChange={set("password")} data-testid="password-input" placeholder="••••••••" /></Field>

              <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="submit-auth-btn">
                {loading && <Loader2 size={16} className="mr-2 animate-spin" />}
                {mode === "login" ? "Log in" : "Create company"}
              </Button>
            </form>

            <div className="my-4 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" /></div>
            <Button variant="outline" onClick={google} className="w-full" data-testid="google-login-btn">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="mr-2 h-4 w-4" /> Continue with Google
            </Button>

            <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">Try the demo</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button type="button" onClick={() => demo("ashwanibarabanki1438@gmail.com")} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 hover:border-emerald-400" data-testid="demo-owner-btn">Owner</button>
                <button type="button" onClick={() => demo("priya@paymitra-demo.in")} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 hover:border-emerald-400" data-testid="demo-employee-btn">Employee</button>
              </div>
            </div>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  );
}
