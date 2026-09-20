import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { Protected, RoleRedirect } from "@/components/Protected";
import AppShell from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";

import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/owner/Dashboard";
import Directory from "@/pages/owner/Directory";
import Attendance from "@/pages/owner/Attendance";
import Automation from "@/pages/owner/Automation";
import Leaves from "@/pages/owner/Leaves";
import Payroll from "@/pages/owner/Payroll";
import Settings from "@/pages/owner/Settings";
import EmpHome from "@/pages/employee/EmpHome";
import SelfAttendance from "@/pages/employee/SelfAttendance";
import EmpLeave from "@/pages/employee/EmpLeave";
import EmpPayslips from "@/pages/employee/EmpPayslips";

function Owner({ children }) {
  return <Protected role="owner"><AppShell>{children}</AppShell></Protected>;
}
function Employee({ children }) {
  return <Protected role="employee"><AppShell>{children}</AppShell></Protected>;
}

function Router() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<RoleRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route path="/dashboard" element={<Owner><Dashboard /></Owner>} />
      <Route path="/directory" element={<Owner><Directory /></Owner>} />
      <Route path="/attendance" element={<Owner><Attendance /></Owner>} />
      <Route path="/automation" element={<Owner><Automation /></Owner>} />
      <Route path="/leaves" element={<Owner><Leaves /></Owner>} />
      <Route path="/payroll" element={<Owner><Payroll /></Owner>} />
      <Route path="/settings" element={<Owner><Settings /></Owner>} />

      <Route path="/me" element={<Employee><EmpHome /></Employee>} />
      <Route path="/me/attendance" element={<Employee><SelfAttendance /></Employee>} />
      <Route path="/me/leaves" element={<Employee><EmpLeave /></Employee>} />
      <Route path="/me/payslips" element={<Employee><EmpPayslips /></Employee>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Router />
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
