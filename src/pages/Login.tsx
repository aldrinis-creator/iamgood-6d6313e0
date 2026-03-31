import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Shield, Heart, Plus, Trash2, Eye, EyeOff, Smartphone } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Separator } from "@/components/ui/separator";
import OtpVerification from "@/components/OtpVerification";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const GoogleSignInButton = ({ label = "Sign in with Google" }: { label?: string }) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: "Google sign-in failed", description: String(error), variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full text-base py-6 gap-3"
      size="lg"
      onClick={handleGoogleSignIn}
      disabled={loading}
    >
      <GoogleIcon />
      {loading ? "Connecting..." : label}
    </Button>
  );
};

const OrDivider = () => (
  <div className="flex items-center gap-3 my-2">
    <Separator className="flex-1" />
    <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
    <Separator className="flex-1" />
  </div>
);

const isPhoneInput = (value: string) => /^\+?\d[\d\s-]{5,}$/.test(value.trim());

const formatPhone = (value: string) => {
  const digits = value.replace(/[\s-]/g, "");
  if (digits.startsWith("+")) return digits;
  return `+91${digits}`;
};

const REMEMBER_KEY = "checkin_remember_id";

const Login = () => {
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(() => localStorage.getItem(REMEMBER_KEY) || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem(REMEMBER_KEY));
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpPhone, setOtpPhone] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let emailToUse = identifier.trim();

      if (isPhoneInput(emailToUse)) {
        const phone = formatPhone(emailToUse);
        const { data, error: fnError } = await supabase.rpc("get_email_by_phone" as any, { _phone: phone });
        if (fnError || !data) {
          toast({ title: "Sign in failed", description: "No account found with this phone number.", variant: "destructive" });
          return;
        }
        emailToUse = data as string;
      }

      const { error } = await signIn(emailToUse, password);
      if (error) {
        toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
      } else {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, identifier.trim());
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast({ title: "Sign in failed", description: err?.message || "An unexpected error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    const { error } = await resetPassword(forgotEmail);
    setForgotLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password reset email sent", description: "Check your inbox for the reset link." });
      setShowForgot(false);
    }
  };

  // OTP login mode
  if (otpMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-success mx-auto flex items-center justify-center">
              <Heart className="w-8 h-8 text-success-foreground fill-current" />
            </div>
            <h1 className="text-2xl font-bold text-primary">Check-iN</h1>
            <p className="text-sm text-muted-foreground">Sign in with OTP</p>
          </div>

          {!otpPhone ? (
            <div className="space-y-4">
              <div>
                <Label>Phone Number</Label>
                <Input
                  placeholder="Enter your phone number"
                  className="text-base"
                  type="tel"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>
              <Button
                className="w-full bg-primary text-lg py-6"
                size="lg"
                onClick={() => {
                  const val = identifier.trim();
                  if (!val) {
                    toast({ title: "Enter phone number", variant: "destructive" });
                    return;
                  }
                  const phone = formatPhone(val);
                  setOtpPhone(phone);
                }}
              >
                Send OTP
              </Button>
              <div className="text-center">
                <button className="text-sm text-primary underline" onClick={() => setOtpMode(false)}>
                  Back to password sign in
                </button>
              </div>
            </div>
          ) : (
            <OtpVerification
              phone={otpPhone}
              onVerified={async () => {
                // After OTP verified, look up email and sign in
                const { data } = await supabase.rpc("get_email_by_phone" as any, { _phone: otpPhone });
                if (data) {
                  toast({ title: "Phone verified!", description: "You're signed in." });
                  navigate("/dashboard");
                } else {
                  toast({ title: "No account found", description: "Please register first.", variant: "destructive" });
                  setOtpPhone("");
                }
              }}
              onCancel={() => setOtpPhone("")}
            />
          )}
        </div>
      </div>
    );
  }

  if (showForgot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-success mx-auto flex items-center justify-center">
              <Heart className="w-8 h-8 text-success-foreground fill-current" />
            </div>
            <h1 className="text-2xl font-bold text-primary">Reset Password</h1>
            <p className="text-sm text-muted-foreground">Enter your email to receive a reset link</p>
          </div>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input placeholder="Enter your email" className="text-base" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full bg-primary text-lg py-6" size="lg" disabled={forgotLoading}>
              {forgotLoading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
          <div className="text-center">
            <button className="text-sm text-primary underline" onClick={() => setShowForgot(false)}>
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-success mx-auto flex items-center justify-center">
            <Heart className="w-8 h-8 text-success-foreground fill-current" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Check-iN</h1>
          <p className="text-sm text-muted-foreground">Your Personal Emergency Response System</p>
        </div>

        <GoogleSignInButton />
        <OrDivider />

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label>Email or Phone</Label>
            <Input placeholder="Enter email or phone number" className="text-base" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </div>
          <div>
            <Label>Password</Label>
            <div className="relative">
              <Input placeholder="Enter password" className="text-base pr-10" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="remember-me" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-primary text-primary" />
            <Label htmlFor="remember-me" className="text-sm font-normal cursor-pointer">Remember my email / phone</Label>
          </div>
          <Button type="submit" className="w-full bg-primary text-lg py-6" size="lg" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <button className="text-sm text-primary font-medium" onClick={() => navigate("/register")}>
            Don't have an account? <span className="underline">Register</span>
          </button>
          <br />
          <button className="text-sm text-muted-foreground" onClick={() => setShowForgot(true)}>Forgot Password?</button>
          <br />
          <button className="text-sm text-primary font-medium flex items-center justify-center gap-1 mx-auto mt-1" onClick={() => setOtpMode(true)}>
            <Smartphone className="w-4 h-4" /> Sign in with OTP
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;

