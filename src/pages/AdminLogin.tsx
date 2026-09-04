import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const passwordChecks = [
  { label: "At least 12 characters", test: (p: string) => p.length >= 12 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /[0-9]/.test(p) },
  { label: "Symbol", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const AdminLogin = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"loading" | "setup" | "login">("loading");
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lockout, setLockout] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke("admin-auth", { body: { action: "exists" } });
      if (error) {
        toast.error("Could not reach admin service");
        setMode("login");
        return;
      }
      if (data?.exists) {
        setMode("login");
      } else {
        setMode("setup");
        setAdminId("checkin_admin");
      }
    })();
  }, []);

  const allPwChecksPass = passwordChecks.every((c) => c.test(password));

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allPwChecksPass) {
      toast.error("Password does not meet requirements");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("admin-auth", {
      body: { action: "setup", admin_id: adminId, password },
    });
    setSubmitting(false);
    if (error || data?.error) {
      toast.error(data?.error || "Setup failed");
      return;
    }
    toast.success("Admin account created. Please sign in.");
    setMode("login");
    setPassword("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setLockout(null);
    const { data, error } = await supabase.functions.invoke("admin-auth", {
      body: { action: "login", admin_id: adminId, password },
    });
    setSubmitting(false);
    if (error || data?.error) {
      const msg = data?.error || "Login failed";
      if (msg.toLowerCase().includes("too many")) {
        setLockout(msg);
      } else {
        toast.error(msg);
      }
      return;
    }
    if (data?.session) {
      const { error: sessErr } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (sessErr) {
        toast.error("Could not establish session");
        return;
      }
      toast.success("Signed in as admin");
      navigate("/admin/coupons");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 safe-top">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-2xl text-primary">
              {mode === "setup" ? "Set Up Admin" : "Admin Sign In"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {mode === "setup"
                ? "Create the admin account for this app."
                : "Restricted area. Authorized personnel only."}
            </p>
          </CardHeader>
          <CardContent>
            {mode === "loading" && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {lockout && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{lockout}</AlertDescription>
              </Alert>
            )}

            {mode !== "loading" && (
              <form onSubmit={mode === "setup" ? handleSetup : handleLogin} className="space-y-4">
                <div>
                  <Label>Admin ID</Label>
                  <Input
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    placeholder="checkin_admin"
                    autoComplete="username"
                    disabled={mode === "setup"}
                    required
                  />
                  {mode === "setup" && (
                    <p className="text-xs text-muted-foreground mt-1">Default admin ID is fixed.</p>
                  )}
                </div>
                <div>
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      autoComplete={mode === "setup" ? "new-password" : "current-password"}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPw(!showPw)}
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {mode === "setup" && (
                    <ul className="text-xs mt-2 space-y-0.5">
                      {passwordChecks.map((c) => {
                        const ok = c.test(password);
                        return (
                          <li key={c.label} className={ok ? "text-success" : "text-muted-foreground"}>
                            {ok ? "✓" : "•"} {c.label}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? "Please wait…" : mode === "setup" ? "Create Admin" : "Sign In"}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline"
                    onClick={() => navigate("/login")}
                  >
                    Back to user sign in
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
