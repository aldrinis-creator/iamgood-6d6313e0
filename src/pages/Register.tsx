import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Shield, Heart, Plus, Trash2, User, ChevronLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

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
      toast({ title: "Google sign-in failed", description: String(error), variant: "destructive" });
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
    <Separator className="flex-1" />
    <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
    <Separator className="flex-1" />
  </div>
);

type SelectedRole = "user" | "guardian" | null;

const TOTAL_STEPS_USER = 3;
const TOTAL_STEPS_GUARDIAN = 2;

const Register = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  // Step management
  const [step, setStep] = useState<number>(1);
  const [selectedRole, setSelectedRole] = useState<SelectedRole>(null);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("+91");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
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
    }
  };

  // Guardian helpers
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

  const validatePhone = (value: string): string | null => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "Phone number is required. You'll use it to sign in later.";
    if (phoneCode === "+91" && !/^[6-9]\d{9}$/.test(digits)) {
      return "Enter a valid 10-digit Indian mobile number (starting with 6-9).";
    }
    if (phoneCode !== "+91" && digits.length < 7) {
      return "Enter a valid phone number.";
    }
    return null;
  };

  const handleDetailsNext = () => {
    if (!fullName || !email || !password) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    const phoneError = validatePhone(phone);
    if (phoneError) {
      toast({ title: "Invalid phone number", description: phoneError, variant: "destructive" });
      return;
    }
    if (selectedRole === "user") {
      setStep(3);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!fullName || !email || !password) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (selectedRole === "user" && (!guardians[0].name || !guardians[0].phone)) {
      toast({ title: "Primary guardian name and phone are required", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { data, error } = await signUp(email, password, { full_name: fullName });

    if (error) {
      setLoading(false);
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
      return;
    }

    const userId = data?.user?.id;
    if (userId) {
      // Update profile with phone, DOB, and role
      await supabase.from("profiles").update({
        phone: `${phoneCode}${phone}`,
        date_of_birth: dob || null,
        role: selectedRole as "user" | "guardian",
      }).eq("id", userId);

      // Insert guardians only for user role
      if (selectedRole === "user") {
        const guardianRows = guardians
          .filter((g) => g.name && g.phone)
          .map((g, i) => ({
            user_id: userId,
            guardian_name: g.name,
            guardian_phone: g.phone,
            relation: g.relation || null,
            is_primary: i === 0,
          }));
        if (guardianRows.length > 0) {
          await supabase.from("guardians").insert(guardianRows);
        }
      }
    }

    setLoading(false);
    toast({ title: "Account created!", description: "Check your email to verify your account." });
    navigate("/dashboard");
  };

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
          {/* Header */}
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
              <div className="flex gap-2">
                <Select value={phoneCode} onValueChange={setPhoneCode}>
                  <SelectTrigger className="w-24 min-h-[48px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+91">+91</SelectItem>
                    <SelectItem value="+1">+1</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="10-digit mobile number" className="flex-1 text-base min-h-[48px]" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" maxLength={10} />
              </div>
            </div>
            <div>
              <Label>Email *</Label>
              <Input placeholder="Email address" className="text-base min-h-[48px]" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>Password *</Label>
              <Input placeholder="Create password" className="text-base min-h-[48px]" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input type="date" className="text-base min-h-[48px]" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
          </div>

          {/* Sticky CTA */}
          <div className="sticky bottom-4 pt-4 mt-4">
            <Button
              type="button"
              className="w-full bg-primary text-lg min-h-[52px]"
              size="lg"
              disabled={loading}
              onClick={handleDetailsNext}
            >
              {selectedRole === "guardian"
                ? loading ? "Creating Account..." : "Create Guardian Account"
                : "Next — Add Guardians"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Step 3: Nominate guardians (user role only) ---
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col p-4 pb-8">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        {/* Header */}
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
                <Label className="text-xs">Name</Label>
                <Input placeholder="Guardian name" className="text-base min-h-[48px]" value={g.name} onChange={(e) => updateGuardian(i, "name", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input placeholder="Phone number" className="text-base min-h-[48px]" value={g.phone} onChange={(e) => updateGuardian(i, "phone", e.target.value)} />
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

        {/* Sticky CTA */}
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
