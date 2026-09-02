import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useGuardianLink } from "@/hooks/useGuardianLink";
import { toast } from "sonner";


const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

/** Only allows users with role='user' (or no profile yet). Redirects guardians to /guardian */
export const UserRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  // Wait for BOTH session and profile — rendering user screens before the
  // profile resolves lets guardian accounts briefly land on the user app
  // (which creates check-ins and fires user alerts for them).
  if (loading || (session && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.role === "guardian") {
    toast.info("Register as a User to access this feature");
    return <Navigate to="/guardian" replace />;
  }

  return <>{children}</>;
};


/**
 * Allows guardians in. A person qualifies either by `profiles.role === 'guardian'`
 * or by being linked as a guardian for at least one ward (dual-role accounts,
 * e.g. someone who already has their own 'user' account).
 */
export const GuardianRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();
  const { isGuardianLinked, loading: linkLoading } = useGuardianLink();

  if (loading || (session && linkLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.role !== "guardian" && !isGuardianLinked) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};


export default ProtectedRoute;
