import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Shield, Heart, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    } else {
      // Role is determined from profile; navigate after auth state updates
      navigate("/dashboard");
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

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input placeholder="Enter email" className="text-base" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Password</Label>
            <Input placeholder="Enter password" className="text-base" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
        </div>
      </div>
    </div>
  );
};

export default Login;

export const Register = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("+91");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [guardians, setGuardians] = useState([{ name: "", phone: "", relation: "" }]);

  const addGuardian = () => {
    if (guardians.length < 5) {
      setGuardians([...guardians, { name: "", phone: "", relation: "" }]);
    }
  };

  const removeGuardian = (i: number) => {
    if (guardians.length > 1) {
      setGuardians(guardians.filter((_, idx) => idx !== i));
    }
  };

  const updateGuardian = (i: number, field: string, value: string) => {
    setGuardians(guardians.map((g, idx) => idx === i ? { ...g, [field]: value } : g));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    // Validate at least primary guardian
    if (!guardians[0].name || !guardians[0].phone) {
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
      // Update profile with phone and DOB
      await supabase.from("profiles").update({
        phone: `${phoneCode}${phone}`,
        date_of_birth: dob || null,
      }).eq("id", userId);

      // Insert guardians
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

    setLoading(false);
    toast({ title: "Account created!", description: "Check your email to verify your account." });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-success mx-auto flex items-center justify-center">
            <Heart className="w-8 h-8 text-success-foreground fill-current" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Create Account</h1>
          <p className="text-sm text-muted-foreground">Set up your safety profile</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Personal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Full Name</Label>
                <Input placeholder="Enter your name" className="text-base" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div>
                <Label>Phone Number</Label>
                <div className="flex gap-2">
                  <Select value={phoneCode} onValueChange={setPhoneCode}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+91">+91</SelectItem>
                      <SelectItem value="+1">+1</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Phone number" className="flex-1 text-base" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input placeholder="Email address" className="text-base" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label>Password</Label>
                <Input placeholder="Create password" className="text-base" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input type="date" className="text-base" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Nominate Guardians
              </CardTitle>
              <p className="text-xs text-muted-foreground">Minimum 1 required • Maximum 5</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {guardians.map((g, i) => (
                <div key={i} className="space-y-2 p-3 rounded-lg bg-muted/50 relative">
                  {i === 0 && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      Primary Guardian
                    </span>
                  )}
                  {i > 0 && (
                    <button type="button" onClick={() => removeGuardian(i)} className="absolute top-2 right-2 text-muted-foreground hover:text-sos">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input placeholder="Guardian name" className="text-base" value={g.name} onChange={(e) => updateGuardian(i, "name", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Phone</Label>
                    <Input placeholder="Phone number" className="text-base" value={g.phone} onChange={(e) => updateGuardian(i, "phone", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Relation</Label>
                    <Select value={g.relation} onValueChange={(val) => updateGuardian(i, "relation", val)}>
                      <SelectTrigger><SelectValue placeholder="Select relation" /></SelectTrigger>
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
                <Button type="button" variant="outline" size="sm" onClick={addGuardian} className="w-full">
                  <Plus className="w-4 h-4 mr-1" /> Add Guardian ({guardians.length}/5)
                </Button>
              )}
            </CardContent>
          </Card>

          <Button type="submit" className="w-full bg-primary text-lg py-6" size="lg" disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button type="button" className="text-primary underline" onClick={() => navigate("/login")}>
              Sign In
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};
