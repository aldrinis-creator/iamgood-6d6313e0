import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Shield, Heart, Plus, Trash2, User, ChevronLeft, Mail, Users, CheckCircle2, ChevronDown } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import OtpVerification from "@/components/OtpVerification";
import PhoneInput from "@/components/PhoneInput";

const getDigitCount = (val: string) => val.replace(/[^\d]/g, "").length;

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const GoogleSignInButton = ({ label = "Sign up with Google" }: { label?: string }) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast.error("Google sign-in failed", { description: String(error) });
    }
    setLoading(false);
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full text-base min-h-[48px] gap-3"
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
    <div className="flex-1 h-px bg-border" />
    <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
    <div className="flex-1 h-px bg-border" />
  </div>
);

type SelectedRole = "user" | "guardian" | null;

const TOTAL_STEPS_USER = 4;
const TOTAL_STEPS_GUARDIAN = 3;

const Register = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<number>(1);
  const [selectedRole, setSelectedRole] = useState<SelectedRole>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [sentGuardianCount, setSentGuardianCount] = useState(0);
  const [guardians, setGuardians] = useState([{ name: "", phone: "", email: "", relation: "" }]);

  const totalSteps = selectedRole === "guardian" ? TOTAL_STEPS_GUARDIAN : TOTAL_STEPS_USER;
  const progressPercent = (step / totalSteps) * 100;

  const handleRoleSelect = (role: SelectedRole) => {
    setSelectedRole(role);
    setStep(2);
  };

  const handleBack = () => {
    if (step === 2 && selectedRole) {
      setStep(1);
      setSelectedRole(null);
    } else if (step === 3) {
      setStep(2);
    } else if (step === 4) {
      setStep(3);
    }
  };

  const addGuardian = () => {
    if (guardians.length < 5) {
      setGuardians([...guardians, { name: "", phone: "", email: "", relation: "" }]);
    }
  };
  const removeGuardian = (i: number) => {
    if (guardians.length > 1) {
      setGuardians(guardians.filter((_, idx) => idx !== i));
    }
  };
  const updateGuardian = (i: number, field: string, value: string) => {
    setGuardians(guardians.map((g, idx) => (idx === i ? { ...g, [field]: value } : g)));
  };

  const [showEmailSection, setShowEmailSection] = useState(false);

  const phoneDigitCount = getDigitCount(phone);
  const isPhoneValid = phoneDigitCount >= 10;

  const generatePlaceholderEmail = (phoneNum: string) => {
    const cleaned = phoneNum.replace(/[\s\-\+]/g, "");
    return `${cleaned}@phone.checkin.app`;
  };

  const handleDetailsNext = () => {
    if (!fullName) {
      toast.error("Please enter your name");
      return;
    }
    if (!isPhoneValid) {
      toast.error("Invalid phone number", { description: "Enter at least 10 digits." });
      return;
    }
    if (email && !password) {
      toast.error("Password is required when email is provided");
      return;
    }
    setStep(3);
  };

  const handleOtpVerified = () => {
    setPhoneVerified(true);
    if (selectedRole === "user") {
      setStep(4); // Guardian nomination
    } else {
      handleSubmit(); // Guardian role: submit directly
    }
  };

  const handleOtpCancel = () => {
    setStep(2); // Back to details
  };

  const sendGuardianInvite = async (guardianEmail: string, guardianName: string, userName: string, relation: string) => {
    try {
      // Send branded guardian invitation via transactional email system
      const baseUrl = "https://iamgood.lovable.app";
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "guardian-invitation",
          recipientEmail: guardianEmail,
          idempotencyKey: `guardian-invite-${guardianEmail}-${Date.now()}`,
          templateData: {
            guardianName,
            userName,
            relation,
            acceptLink: `${baseUrl}/register`,
          },
        },
      });
      // Also send WhatsApp/SMS via the old function (keeps MSG91 integration)
      await supabase.functions.invoke("send-guardian-invite", {
        body: { guardian_name: guardianName, user_name: userName, relation },
      });
    } catch (e) {
      console.error("Failed to send guardian invite:", e);
    }
  };

  const handleSubmit = async () => {
    if (!fullName) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (selectedRole === "user" && (!guardians[0].name || !guardians[0].phone)) {
      toast.error("Primary guardian name and phone are required");
      return;
    }
    if (selectedRole === "user") {
      for (const g of guardians.filter(g => g.phone)) {
        if (getDigitCount(g.phone) < 10) {
          toast.error("Invalid guardian phone", { description: `${g.name || "A guardian"} has fewer than 10 digits in their phone number.` });
          return;
        }
      }
    }

    // Check 3-ward limit for each nominated guardian with an email
    if (selectedRole === "user") {
      for (const g of guardians.filter(g => g.email)) {
        const { data: countResult } = await supabase.rpc("guardian_ward_count", { _guardian_email: g.email });
        if (typeof countResult === "number" && countResult >= 3) {
          toast.error("Guardian limit reached", { description: `${g.name || g.email} already monitors 3 users (maximum). Please choose a different guardian.` });
          return;
        }
      }
    }

    const guardianRows = selectedRole === "user"
      ? guardians
          .filter((g) => g.name && g.phone)
          .map((g, i) => ({
            guardian_name: g.name.trim(),
            guardian_phone: g.phone.replace(/\s/g, ""),
            guardian_email: g.email?.trim() || null,
            relation: g.relation || null,
            is_primary: i === 0,
          }))
      : [];

    // Use provided email or generate placeholder for phone-only registration
    const emailToUse = email.trim() || generatePlaceholderEmail(phone);
    const passwordToUse = password || crypto.randomUUID();

    setLoading(true);
    const { data, error } = await signUp(emailToUse, passwordToUse, { 
      full_name: fullName,
      app_role: selectedRole || "user",
      phone: phone.replace(/\s/g, ""),
      date_of_birth: dob || "",
      guardians: guardianRows,
    });

    if (error) {
      setLoading(false);
      toast.error("Registration failed", { description: error.message });
      return;
    }

    const guardiansWithEmail = guardianRows.filter(g => g.guardian_email);
    if (selectedRole === "user") {
      for (const g of guardiansWithEmail) {
        if (g.guardian_email) {
          sendGuardianInvite(g.guardian_email, g.guardian_name, fullName, g.relation || "");
        }
      }
    }
    setSentGuardianCount(guardiansWithEmail.length);

    if (selectedRole === "guardian" && data?.user?.id) {
      await supabase.rpc("link_guardian_user_id");
    }

    setLoading(false);
    setRegistrationComplete(true);
  };

  // --- Registration success screen ---
  if (registrationComplete) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4 pb-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="w-20 h-20 rounded-full bg-success/10 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Account Created!</h1>
            <p className="text-muted-foreground">Welcome to Check-iN, {fullName}.</p>
          </div>

          <Separator />

          <div className="space-y-4 text-left">
            {email ? (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <Mail className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">Verify your email</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    We've sent a verification link to <strong className="text-foreground">{email}</strong>. Please check your inbox and click the link to activate your account.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-success/5 border border-success/10">
                <CheckCircle2 className="w-5 h-5 text-success mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">Phone verified — you're all set!</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Sign in with your phone number and OTP. You can add an email later from Settings.
                  </p>
                </div>
              </div>
            )}

            {selectedRole === "user" && sentGuardianCount > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-success/5 border border-success/10">
                <Users className="w-5 h-5 text-success mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">Guardian invitations sent</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {sentGuardianCount === 1
                      ? "An invitation email has been sent to your guardian."
                      : `Invitation emails have been sent to ${sentGuardianCount} guardians.`}
                    {" "}They'll receive instructions to set up their guardian account.
                  </p>
                </div>
              </div>
            )}

            {selectedRole === "user" && sentGuardianCount === 0 && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border">
                <Users className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">No guardian invitations sent</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Your guardians were saved but no email invitations were sent (no email addresses provided). You can add guardian emails later from Settings.
                  </p>
                </div>
              </div>
            )}

            {selectedRole === "guardian" && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">Guardian account ready</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Once you verify your email, you'll be able to monitor and respond to your ward's safety check-ins.
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <Button
            className="w-full text-lg min-h-[52px]"
            size="lg"
            onClick={() => navigate("/login")}
          >
            Go to Sign In
          </Button>

          <p className="text-xs text-muted-foreground">
            Didn't receive the email? Check your spam folder or sign in to resend the verification.
          </p>
        </div>
      </div>
    );
  }

  // --- Step 1: Role selection ---
  if (step === 1) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4 pb-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-success mx-auto flex items-center justify-center">
              <Heart className="w-8 h-8 text-success-foreground fill-current" />
            </div>
            <h1 className="text-2xl font-bold text-primary">Create Account</h1>
            <p className="text-sm text-muted-foreground">How will you use Check-iN?</p>
          </div>

          <div className="grid gap-4">
            <button
              type="button"
              onClick={() => handleRoleSelect("user")}
              className="flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-card text-left transition-colors hover:border-primary focus:border-primary focus:outline-none min-h-[80px]"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Heart className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-base">I need protection</p>
                <p className="text-sm text-muted-foreground">Set up check-ins & nominate guardians</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect("guardian")}
              className="flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-card text-left transition-colors hover:border-primary focus:border-primary focus:outline-none min-h-[80px]"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-base">I'm a Guardian</p>
                <p className="text-sm text-muted-foreground">Monitor & respond to someone's safety</p>
              </div>
            </button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button type="button" className="text-primary underline font-medium" onClick={() => navigate("/login")}>
              Sign In
            </button>
          </p>
        </div>
      </div>
    );
  }

  // --- Step 2: Personal details ---
  if (step === 2) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col p-4 pb-8">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <button type="button" onClick={handleBack} className="p-2 -ml-2 rounded-lg hover:bg-muted">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex-1">
              <Progress value={progressPercent} className="h-2" />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Step {step}/{totalSteps}
            </span>
          </div>

          <div className="text-center space-y-1 mb-6">
            <h1 className="text-xl font-bold text-foreground">
              {selectedRole === "guardian" ? "Guardian Details" : "Your Details"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {selectedRole === "guardian"
                ? "Set up your guardian account"
                : "Tell us about yourself"}
            </p>
          </div>

          <GoogleSignInButton label="Sign up with Google" />
          <OrDivider />

          <div className="space-y-4 flex-1">
            <div>
              <Label>Full Name *</Label>
              <Input placeholder="Enter your name" className="text-base min-h-[48px]" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <Label>Phone Number *</Label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                placeholder="98765 43210"
                className="min-h-[48px]"
              />
              {phone.trim().length > 0 && !isPhoneValid && (
                <p className="text-sm text-destructive mt-1">Enter at least 10 digits</p>
              )}
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input type="date" className="text-base min-h-[48px]" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>

            <Collapsible open={showEmailSection} onOpenChange={setShowEmailSection}>
              <CollapsibleTrigger asChild>
                <button type="button" className="flex items-center gap-2 text-sm text-primary font-medium w-full py-2">
                  <Mail className="w-4 h-4" />
                  Add email for notifications (optional)
                  <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showEmailSection ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div>
                  <Label>Email</Label>
                  <Input placeholder="Email address" className="text-base min-h-[48px]" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {email && (
                  <div>
                    <Label>Password</Label>
                    <Input placeholder="Create password" className="text-base min-h-[48px]" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <p className="text-xs text-muted-foreground mt-1">Required when email is provided</p>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
            <div>
              <Label>Date of Birth</Label>
              <Input type="date" className="text-base min-h-[48px]" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
          </div>

          <div className="sticky bottom-4 pt-4 mt-4">
            <Button
              type="button"
              className="w-full bg-primary text-lg min-h-[52px]"
              size="lg"
              disabled={loading}
              onClick={handleDetailsNext}
            >
              {selectedRole === "guardian"
                ? loading ? "Creating Account..." : "Next — Verify Phone"
                : "Next — Verify Phone"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Step 3: OTP verification ---
  if (step === 3) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col p-4 pb-8">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <button type="button" onClick={handleOtpCancel} className="p-2 -ml-2 rounded-lg hover:bg-muted">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex-1">
              <Progress value={(3 / totalSteps) * 100} className="h-2" />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Step 3/{totalSteps}
            </span>
          </div>

          <div className="mt-8">
            <OtpVerification
              phone={phone.replace(/\s/g, "")}
              purpose="register"
              onVerified={handleOtpVerified}
              onCancel={handleOtpCancel}
            />
          </div>
        </div>
      </div>
    );
  }

  // --- Step 4: Nominate guardians (user role only) ---
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col p-4 pb-8">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <button type="button" onClick={handleBack} className="p-2 -ml-2 rounded-lg hover:bg-muted">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <Progress value={progressPercent} className="h-2" />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Step {step}/{totalSteps}
          </span>
        </div>

        <div className="text-center space-y-1 mb-6">
          <h1 className="text-xl font-bold text-foreground">Nominate Guardians</h1>
          <p className="text-sm text-muted-foreground">Minimum 1 required • Maximum 5</p>
        </div>

        <div className="space-y-4 flex-1">
          {guardians.map((g, i) => (
            <div key={i} className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border relative">
              {i === 0 && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  Primary Guardian
                </span>
              )}
              {i > 0 && (
                <button type="button" onClick={() => removeGuardian(i)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <div>
                <Label className="text-xs">Name *</Label>
                <Input placeholder="Guardian name" className="text-base min-h-[48px]" value={g.name} onChange={(e) => updateGuardian(i, "name", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Phone *</Label>
                <PhoneInput
                  value={g.phone}
                  onChange={(val) => updateGuardian(i, "phone", val)}
                  placeholder="98765 43210"
                />
                {g.phone.trim().length > 0 && getDigitCount(g.phone) < 10 && (
                  <p className="text-sm text-destructive mt-1">Enter at least 10 digits</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Email {i === 0 ? "*" : "(for notifications)"}</Label>
                <Input placeholder="guardian@email.com" type="email" className="text-base min-h-[48px]" value={g.email} onChange={(e) => updateGuardian(i, "email", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Relation</Label>
                <Select value={g.relation} onValueChange={(val) => updateGuardian(i, "relation", val)}>
                  <SelectTrigger className="min-h-[48px]"><SelectValue placeholder="Select relation" /></SelectTrigger>
                  <SelectContent>
                    {["Spouse", "Son", "Daughter", "Sibling", "Friend", "Neighbor", "Other"].map((r) => (
                      <SelectItem key={r} value={r.toLowerCase()}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          {guardians.length < 5 && (
            <Button type="button" variant="outline" size="sm" onClick={addGuardian} className="w-full min-h-[44px]">
              <Plus className="w-4 h-4 mr-1" /> Add Guardian ({guardians.length}/5)
            </Button>
          )}
        </div>

        <div className="sticky bottom-4 pt-4 mt-4">
          <Button
            type="button"
            className="w-full bg-primary text-lg min-h-[52px]"
            size="lg"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Register;
