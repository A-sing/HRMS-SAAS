import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export function Protected({ children, role }) {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f6f8f9]">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "owner" ? "/dashboard" : "/me"} replace />;
  }
  return children;
}

export function RoleRedirect() {
  const { user } = useAuth();
  if (user === null) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "owner" ? "/dashboard" : "/me"} replace />;
}
