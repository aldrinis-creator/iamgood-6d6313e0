import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

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

  if (loading || (user && isAdmin === null)) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Checking access…</div>;
  }

  if (!user || !isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default AdminRoute;
