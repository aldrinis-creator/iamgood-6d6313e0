import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Toggle to enable mandatory 2FA step-up for admin routes.
// All 2FA infrastructure (tables, edge function, /admin/verify page) remains intact when false.
const ADMIN_2FA_ENABLED = false;

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stepUpValid, setStepUpValid] = useState<boolean | null>(ADMIN_2FA_ENABLED ? null : true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  useEffect(() => {
    if (!ADMIN_2FA_ENABLED) return;
    if (!user || isAdmin !== true) return;
    const token = sessionStorage.getItem("admin_step_up_token");
    if (!token) { setStepUpValid(false); return; }
    supabase.functions.invoke("admin-2fa", { body: { action: "validate", token } })
      .then(({ data, error }) => {
        if (error || data?.error || !data?.success) {
          sessionStorage.removeItem("admin_step_up_token");
          setStepUpValid(false);
        } else {
          setStepUpValid(true);
        }
      });
  }, [user, isAdmin]);

  if (loading || (user && isAdmin === null) || (isAdmin === true && stepUpValid === null)) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Checking access…</div>;
  }

  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />;
  if (!stepUpValid) return <Navigate to={`/admin/verify?next=${encodeURIComponent(location.pathname)}`} replace />;

  return <>{children}</>;
};

export default AdminRoute;
