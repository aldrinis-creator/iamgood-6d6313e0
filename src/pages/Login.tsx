import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Smartphone, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

import OtpVerification from "@/components/OtpVerification";
import PhoneInput from "@/components/PhoneInput";

// Only allow same-origin relative paths as post-login redirect targets.
const sanitizeNext = (raw: string | null): string | null => {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
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
  const [searchParams] = useSearchParams();
  const nextPath = sanitizeNext(searchParams.get("next"));
  const [identifier, setIdentifier] = useState(() => localStorage.getItem(REMEMBER_KEY) || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem(REMEMBER_KEY));
  const [loading, setLoading] = useState(false);
  
  // Navigation states
  const [emailMode, setEmailMode] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  
  const [otpPhone, setOtpPhone] = useState("");
  
  const [showResendVerify, setShowResendVerify] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const redirectUri = nextPath
      ? `${window.location.origin}${nextPath}`
      : window.location.origin;
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: redirectUri,
    });
    if (error) {
      toast.error("Google sign-in failed", { description: String(error) });
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let emailToUse = identifier.trim();

      if (isPhoneInput(emailToUse)) {
        const phone = formatPhone(emailToUse);
        const { data, error: fnError } = await supabase.rpc("get_email_by_phone" as any, { _phone: phone });
        if (fnError || !data) {
          toast.error("No account found with this phone number.");
          setLoading(false);
          return;
        }
        emailToUse = data as string;
      }

      const { error } = await signIn(emailToUse, password);
      if (error) {
        if (error.message?.toLowerCase().includes("email not confirmed")) {
          setResendEmail(emailToUse);
          setShowResendVerify(true);
        } else {
          toast.error("Sign in failed", { description: error.message });
        }
      } else {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, identifier.trim());
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
        navigate(nextPath ?? "/dashboard");
      }
    } catch (err: any) {
      toast.error("Sign in failed", { description: err?.message || "An unexpected error occurred" });
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
      toast.error(error.message);
    } else {
      toast.success("Password reset email sent", { description: "Check your inbox for the reset link." });
      setShowForgot(false);
    }
  };

  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setResendLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: resendEmail.trim(),
    });
    setResendLoading(false);
    if (error) {
      toast.error("Could not resend", { description: error.message });
    } else {
      toast.success("Verification email sent!", { description: "Check your inbox and click the link." });
    }
  };

  // OTP FLOW
  if (otpMode) {
    return (
      <div className="dark min-h-screen bg-[#08111F] text-auth-text-1 font-sans px-4 py-6 flex flex-col items-center">
        <div className="w-full max-w-[320px] flex-1 flex flex-col pt-4">
          <div className="flex items-center gap-2 text-[13px] text-auth-text-2 cursor-pointer mb-2" onClick={() => setOtpMode(false)}>
            ‹ Back
          </div>

          {!otpPhone ? (() => {
            const digitCount = identifier.replace(/[^\d]/g, "").length;
            const hasInput = identifier.trim().length > 0;
            const isValid = digitCount >= 10;
            return (
              <>
                <div className="mb-6 mt-2">
                  <h1 className="text-[22px] font-bold text-auth-text-1 tracking-tight mb-1.5">Enter your<br/>phone number</h1>
                  <div className="text-[14px] text-auth-text-2">We'll send you a one-time code to sign in</div>
                </div>

                <div className="mb-3">
                  <label className="block text-[12px] font-semibold text-auth-text-2 tracking-wide uppercase mb-1.5">Phone number</label>
                  <div className="bg-navy-mid border border-auth-border-hi rounded-xl p-1">
                    <PhoneInput
                      value={identifier}
                      onChange={setIdentifier}
                      placeholder="98765 43210"
                      className="border-0 shadow-none bg-transparent h-12"
                    />
                  </div>
                  {hasInput && !isValid && (
                    <p className="text-[11px] text-auth-red mt-1.5">Enter at least 10 digits</p>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <div 
                    onClick={() => setRememberMe(!rememberMe)}
                    className={`w-5 h-5 rounded-[5px] border-[1.5px] flex items-center justify-center cursor-pointer shrink-0 transition-colors ${rememberMe ? 'bg-auth-green border-auth-green text-[#0A1525]' : 'bg-navy-mid border-auth-border-hi'}`}
                  >
                    {rememberMe && <span className="text-xs font-bold">✓</span>}
                  </div>
                  <div className="text-[13px] text-auth-text-2 cursor-pointer select-none" onClick={() => setRememberMe(!rememberMe)}>Remember this phone number</div>
                </div>

                <div className="mt-auto pt-6 flex flex-col gap-2">
                  <button 
                    disabled={!isValid}
                    onClick={() => {
                      const phone = formatPhone(identifier.trim());
                      setOtpPhone(phone);
                    }}
                    className="w-full bg-auth-green text-[#0A1525] text-[17px] font-bold py-4 rounded-2xl flex items-center justify-center disabled:opacity-50 transition-transform active:scale-[0.98]"
                  >
                    Send OTP ›
                  </button>
                  <div className="text-center text-[12px] text-auth-text-3 mt-1 leading-relaxed">A 6-digit code will be sent via SMS to this number</div>
                </div>
              </>
            );
          })() : (
            <>
              <div className="mb-6 mt-2">
                <h1 className="text-[22px] font-bold text-auth-text-1 tracking-tight mb-1.5">Enter the code</h1>
                <div className="text-[14px] text-auth-text-2">Sent to <strong className="text-auth-text-1">{otpPhone}</strong></div>
              </div>
              <OtpVerification
                phone={otpPhone}
                onVerified={async (data) => {
                  if (data?.no_account) {
                    toast.error("No account found", { description: "Please register first." });
                    setOtpPhone("");
                    return;
                  }
                  if (data?.token_hash && data?.email) {
                    const { error: verifyError } = await supabase.auth.verifyOtp({
                      token_hash: data.token_hash,
                      type: "magiclink",
                    });
                    if (verifyError) {
                      toast.error("Sign in failed", { description: verifyError.message });
                      return;
                    }
                    toast.success("Signed in successfully!");
                    navigate("/dashboard");
                  } else {
                    toast.error("Could not create session. Please try again.");
                    setOtpPhone("");
                  }
                }}
                onCancel={() => setOtpPhone("")}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  // EMAIL FORM
  if (emailMode) {
    return (
      <div className="dark min-h-screen bg-[#08111F] text-auth-text-1 font-sans px-4 py-6 flex flex-col items-center">
        <div className="w-full max-w-[320px] flex-1 flex flex-col pt-4">
          <div className="flex items-center gap-2 text-[13px] text-auth-text-2 cursor-pointer mb-2" onClick={() => setEmailMode(false)}>
            ‹ Back
          </div>
          
          <div className="mb-6 mt-2">
            <h1 className="text-[22px] font-bold text-auth-text-1 tracking-tight mb-1.5">Sign in<br/>with Email</h1>
            <div className="text-[14px] text-auth-text-2">Enter your email and password</div>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-3 flex-1">
            <div>
              <label className="block text-[12px] font-semibold text-auth-text-2 tracking-wide uppercase mb-1.5">Email address</label>
              <input 
                type="text" 
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-navy-mid border border-auth-border-hi rounded-[10px] p-[13px] text-auth-text-1 text-base placeholder:text-auth-text-3 outline-none focus:border-auth-green transition-colors"
                required
              />
            </div>
            
            <div>
              <label className="block text-[12px] font-semibold text-auth-text-2 tracking-wide uppercase mb-1.5">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-navy-mid border border-auth-border-hi rounded-[10px] py-[13px] pl-[13px] pr-10 text-auth-text-1 text-base placeholder:text-auth-text-3 outline-none focus:border-auth-green transition-colors"
                  required
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-auth-text-3" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="text-right mt-2">
                <button type="button" className="text-[12px] text-auth-green" onClick={() => setShowForgot(true)}>Forgot Password?</button>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <div 
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-5 h-5 rounded-[5px] border-[1.5px] flex items-center justify-center cursor-pointer shrink-0 transition-colors ${rememberMe ? 'bg-auth-green border-auth-green text-[#0A1525]' : 'bg-navy-mid border-auth-border-hi'}`}
              >
                {rememberMe && <span className="text-xs font-bold">✓</span>}
              </div>
              <div className="text-[13px] text-auth-text-2 cursor-pointer select-none" onClick={() => setRememberMe(!rememberMe)}>Remember my email</div>
            </div>

            <div className="mt-auto pt-6 pb-4">
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-auth-green text-[#0A1525] text-[17px] font-bold py-4 rounded-2xl flex items-center justify-center disabled:opacity-50 transition-transform active:scale-[0.98]"
              >
                {loading ? "Signing in..." : "Sign in ›"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // OTHER STATES (Forgot Password, Resend Verify)
  if (showForgot) {
    return (
      <div className="dark min-h-screen bg-[#08111F] text-auth-text-1 font-sans px-4 py-6 flex items-center justify-center">
        <div className="w-full max-w-[320px] flex flex-col">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">Reset Password</h1>
            <p className="text-sm text-auth-text-2">Enter your email to receive a reset link</p>
          </div>
          <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
            <input 
              type="email" 
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="Email address"
              className="w-full bg-navy-mid border border-auth-border-hi rounded-[10px] p-[13px] text-auth-text-1 text-base outline-none focus:border-auth-green"
              required
            />
            <button type="submit" disabled={forgotLoading} className="w-full bg-auth-green text-[#0A1525] text-[17px] font-bold py-4 rounded-2xl">
              {forgotLoading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
          <button className="text-[13px] text-auth-text-3 mt-6" onClick={() => setShowForgot(false)}>‹ Back to Sign In</button>
        </div>
      </div>
    );
  }

  if (showResendVerify) {
    return (
      <div className="dark min-h-screen bg-[#08111F] text-auth-text-1 font-sans px-4 py-6 flex items-center justify-center">
        <div className="w-full max-w-[320px] flex flex-col">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">Email Not Verified</h1>
            <p className="text-sm text-auth-text-2">Check your inbox or resend the verification email.</p>
          </div>
          <form onSubmit={handleResendVerification} className="flex flex-col gap-4">
            <input 
              type="email" 
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="Email address"
              className="w-full bg-navy-mid border border-auth-border-hi rounded-[10px] p-[13px] text-auth-text-1 text-base outline-none focus:border-auth-green"
              required
            />
            <button type="submit" disabled={resendLoading} className="w-full bg-auth-green text-[#0A1525] text-[17px] font-bold py-4 rounded-2xl">
              {resendLoading ? "Sending..." : "Resend Verification Email"}
            </button>
          </form>
          <button className="text-[13px] text-auth-text-3 mt-6" onClick={() => setShowResendVerify(false)}>‹ Back to Sign In</button>
        </div>
      </div>
    );
  }

  // MAIN SELECTION
  return (
    <div className="dark min-h-screen bg-[#08111F] text-auth-text-1 font-sans px-4 pt-8 pb-16 flex flex-col items-center">
      <div className="w-full max-w-[320px] flex-1 flex flex-col pt-[6vh]">
        
        <div className="flex flex-col items-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-navy-mid border-[1.5px] border-auth-green/30 flex items-center justify-center">
            <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
              <path d="M18 4L22 8H30V16L34 18L30 20V28H22L18 32L14 28H6V20L2 18L6 16V8H14L18 4Z" stroke="#2ECC8A" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(46,204,138,0.08)"/>
              <path d="M12 18L16 22L24 14" stroke="#2ECC8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="text-[20px] font-bold text-auth-text-1 tracking-tight">Check-iN</div>
        </div>

        <h1 className="text-[22px] font-bold text-auth-text-1 tracking-tight mb-1.5">Welcome back</h1>
        <div className="text-[14px] text-auth-text-2 mb-[18px]">Sign in to your safety network</div>

        {/* Primary Method */}
        <div className="text-[11px] font-semibold text-auth-text-3 tracking-widest uppercase mb-2 mt-2">Recommended</div>
        
        <div 
          onClick={() => setOtpMode(true)}
          className="bg-auth-green-glow/20 border-[1.5px] border-auth-green rounded-2xl p-3.5 mb-2.5 flex items-center gap-3.5 cursor-pointer hover:bg-auth-green-glow/30 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-auth-green-glow flex items-center justify-center text-[18px] shrink-0">📱</div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-auth-text-1 mb-0.5">Phone OTP</div>
            <div className="text-[12px] text-auth-text-2">Get a code on your mobile</div>
          </div>
          <div className="text-[16px] text-auth-green">›</div>
        </div>

        <div className="text-[11px] font-semibold text-auth-text-3 tracking-widest uppercase mt-3.5 mb-2">Other options</div>
        
        <div 
          onClick={handleGoogleSignIn} 
          className="bg-navy-card border-[1.5px] border-auth-border rounded-2xl p-3.5 mb-2.5 flex items-center gap-3.5 cursor-pointer hover:border-auth-border-hi transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            <GoogleIcon />
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-auth-text-1 mb-0.5">Google</div>
            <div className="text-[12px] text-auth-text-2">Continue with your Google account</div>
          </div>
          <div className="text-[16px] text-auth-text-3">›</div>
        </div>

        <div 
          onClick={() => setEmailMode(true)} 
          className="bg-navy-card border-[1.5px] border-auth-border rounded-2xl p-3.5 mb-2.5 flex items-center gap-3.5 cursor-pointer hover:border-auth-border-hi transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-[18px] shrink-0">🔑</div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-auth-text-1 mb-0.5">Email & password</div>
            <div className="text-[12px] text-auth-text-2">Sign in with email address</div>
          </div>
          <div className="text-[16px] text-auth-text-3">›</div>
        </div>

        <div className="mt-auto pt-6 text-center">
          <div className="text-[13px] text-auth-text-3 cursor-pointer" onClick={() => navigate("/register")}>
            New to Check-iN? <span className="text-auth-green font-semibold">Create account</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
