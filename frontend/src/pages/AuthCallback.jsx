import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import api, { TOKEN_KEY } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser, loadCompany } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const hash = location.hash || window.location.hash;
    const sid = new URLSearchParams(hash.replace(/^#/, "")).get("session_id");
    if (!sid) { navigate("/login", { replace: true }); return; }
    (async () => {
      try {
        const { data } = await api.post("/auth/google", { session_id: sid });
        localStorage.setItem(TOKEN_KEY, data.token);
        setUser(data.user);
        loadCompany();
        window.history.replaceState(null, "", "/");
        navigate(data.user.role === "owner" ? "/dashboard" : "/me", { replace: true });
      } catch (e) {
        navigate("/login?error=google", { replace: true });
      }
    })();
  }, [location, navigate, setUser, loadCompany]);

  return (
    <div className="grid min-h-screen place-items-center bg-[#f6f8f9]">
      <div className="text-center">
        <Loader2 className="mx-auto animate-spin text-emerald-600" size={32} />
        <p className="mt-3 text-sm text-slate-500">Signing you in…</p>
      </div>
    </div>
  );
}
