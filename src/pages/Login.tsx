import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp, UserRole } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { Shield, Heart, Plus, Trash2 } from "lucide-react";

const Login = () => {
  const { setIsLoggedIn, setRole, setUserName } = useApp();
  const navigate = useNavigate();
  const [loginRole, setLoginRole] = useState<UserRole>("user");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setRole(loginRole);
    setIsLoggedIn(true);
    navigate(loginRole === "user" ? "/dashboard" : "/guardian");
  };

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

        {/* Role Selection */}
        <div className="flex gap-2">
          <button
            onClick={() => setLoginRole("user")}
            className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
              loginRole === "user"
                ? "border-primary bg-primary/5"
                : "border-border"
            }`}
          >
            <Heart className="w-6 h-6 mx-auto mb-1 text-primary" />
            <p className="text-sm font-semibold">User</p>
            <p className="text-xs text-muted-foreground">Being protected</p>
          </button>
          <button
            onClick={() => setLoginRole("guardian")}
            className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
              loginRole === "guardian"
                ? "border-primary bg-primary/5"
                : "border-border"
            }`}
          >
            <Shield className="w-6 h-6 mx-auto mb-1 text-primary" />
            <p className="text-sm font-semibold">Guardian</p>
            <p className="text-xs text-muted-foreground">Family/Responder</p>
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label>Email or Phone</Label>
            <Input placeholder="Enter email or phone" className="text-base" type="email" />
          </div>
          <div>
            <Label>Password</Label>
            <Input placeholder="Enter password" className="text-base" type="password" />
          </div>
          <Button type="submit" className="w-full bg-primary text-lg py-6" size="lg">
            Sign In
          </Button>
        </form>

        <div className="text-center space-y-2">
          <button className="text-sm text-primary font-medium" onClick={() => navigate("/register")}>
            Don't have an account? <span className="underline">Register</span>
          </button>
          <br />
          <button className="text-sm text-muted-foreground">Forgot Password?</button>
        </div>
      </div>
    </div>
  );
};

export default Login;

export const Register = () => {
  const { setIsLoggedIn, setRole, setUserName } = useApp();
  const navigate = useNavigate();
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

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRole("user");
    setIsLoggedIn(true);
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
          {/* Personal Details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Personal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Full Name</Label>
                <Input placeholder="Enter your name" className="text-base" />
              </div>
              <div>
                <Label>Phone Number</Label>
                <div className="flex gap-2">
                  <Select defaultValue="+91">
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+91">+91</SelectItem>
                      <SelectItem value="+1">+1</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Phone number" className="flex-1 text-base" />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input placeholder="Email address" className="text-base" type="email" />
              </div>
              <div>
                <Label>Password</Label>
                <Input placeholder="Create password" className="text-base" type="password" />
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input type="date" className="text-base" />
              </div>
            </CardContent>
          </Card>

          {/* Guardians */}
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
                    <button
                      type="button"
                      onClick={() => removeGuardian(i)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-sos"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input placeholder="Guardian name" className="text-base" />
                  </div>
                  <div>
                    <Label className="text-xs">Phone</Label>
                    <Input placeholder="Phone number" className="text-base" />
                  </div>
                  <div>
                    <Label className="text-xs">Relation</Label>
                    <Select>
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

          <Button type="submit" className="w-full bg-primary text-lg py-6" size="lg">
            Create Account
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
