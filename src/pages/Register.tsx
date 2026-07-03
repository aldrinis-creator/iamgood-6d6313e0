import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import OtpVerification from "@/components/OtpVerification";
import PhoneInput from "@/components/PhoneInput";
import usePwaInstall from "@/hooks/usePwaInstall";

const getDigitCount = (val: string) => val.replace(/[^\d]/g, "").length;

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

type SelectedRole = "user" | "guardian" | null;
const TOTAL_STEPS_USER = 4;
const TOTAL_STEPS_GUARDIAN = 3;

const Register = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { canInstall, installApp, isInstalled } = usePwaInstall();
  const [searchParams] = useSearchParams();

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
  
  const [nominationBlocked, setNominationBlocked] = useState(false);
  const [isInviteLink, setIsInviteLink] = useState(false);
  const [showEmailSection, setShowEmailSection] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const totalSteps = selectedRole === "guardian" ? TOTAL_STEPS_GUARDIAN : TOTAL_STEPS_USER;
  const progressPercent = (step / totalSteps) * 100;

  useEffect(() => {
    const nomination = searchParams.get("nomination");
    const token = searchParams.get("token");
    if (nomination === "accept" && token) {
      setIsInviteLink(true);
      setSelectedRole("guardian");
      setStep(2);
      supabase.from("guardians").select("guardian_name, guardian_phone").eq("nomination_token", token).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setFullName(data.guardian_name || "");
            if (data.guardian_phone) setPhone(data.guardian_phone);
          }
        });
    }
  }, [searchParams]);

  const handleRoleSelect = (role: SelectedRole) => {
    setSelectedRole(role);
    if (role === "guardian") {
      // Don't auto-advance for guardian, force them to read the warning and click next
    } else {
      setStep(2);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast.error("Google sign-in failed", { description: String(error) });
    }
    setGoogleLoading(false);
  };

  const handleBack = () => {
    if (step === 2) {
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

  const isPhoneValid = getDigitCount(phone) >= 10;

  const handleDetailsNext = () => {
    if (!fullName) return toast.error("Please enter your name");
    if (!isPhoneValid) return toast.error("Invalid phone number", { description: "Enter at least 10 digits." });
    if (email && !password) return toast.error("Password is required when email is provided");
    setStep(3);
  };

  const handleOtpVerified = async () => {
    setPhoneVerified(true);
    if (selectedRole === "user") {
      setStep(4);
    } else {
      const cleanPhone = phone.replace(/[\s\-\+]/g, "");
      const { data: hasNomination } = await supabase.rpc("check_guardian_nomination" as any, { _phone: cleanPhone });
      if (!hasNomination) {
        setNominationBlocked(true);
        return;
      }
      const { data: wardCount } = await supabase.rpc("guardian_ward_count_by_phone" as any, { _phone: cleanPhone });
      if (typeof wardCount === "number" && wardCount >= 3) {
        toast.error("Ward limit reached", { description: "You already monitor 3 users (maximum)." });
        return;
      }
      handleSubmit();
    }
  };

  const handleOtpCancel = () => setStep(2);

  const sendGuardianInvite = async (guardianEmail: string, guardianName: string, userName: string, relation: string) => {
    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: { templateName: "guardian-invitation", recipientEmail: guardianEmail, idempotencyKey: `guardian-invite-${guardianEmail}-${Date.now()}`, templateData: { guardianName, userName, relation, acceptLink: `https://iamgood.lovable.app/register` } },
      });
      await supabase.functions.invoke("send-guardian-invite", {
        body: { guardian_name: guardianName, user_name: userName, relation },
      });
    } catch (e) {
      console.error("Failed to send guardian invite:", e);
    }
  };

  const handleSubmit = async () => {
    if (!fullName) return toast.error("Please fill in all required fields");
    if (selectedRole === "user" && (!guardians[0].name || !guardians[0].phone)) {
      toast.error("Primary guardian name and phone are required");
      return;
    }
    
    if (selectedRole === "user") {
      for (const g of guardians.filter(g => g.phone)) {
        if (getDigitCount(g.phone) < 10) return toast.error("Invalid guardian phone", { description: `${g.name || "A guardian"} has fewer than 10 digits.` });
        
        const cleanGPhone = g.phone.replace(/[\s\-\+]/g, "");
        const { data: phoneCount } = await supabase.rpc("guardian_ward_count_by_phone" as any, { _phone: cleanGPhone });
        if (typeof phoneCount === "number" && phoneCount >= 3) return toast.error("Guardian limit reached", { description: `${g.name || g.phone} already monitors 3 users.` });
        
        if (g.email) {
          const { data: emailCount } = await supabase.rpc("guardian_ward_count", { _guardian_email: g.email });
          if (typeof emailCount === "number" && emailCount >= 3) return toast.error("Guardian limit reached", { description: `${g.name || g.email} already monitors 3 users.` });
        }
      }
    }

    const guardianRows = selectedRole === "user" ? guardians.filter(g => g.name && g.phone).map((g, i) => ({ guardian_name: g.name.trim(), guardian_phone: g.phone.replace(/\s/g, ""), guardian_email: g.email?.trim() || null, relation: g.relation || null, is_primary: i === 0 })) : [];
    const emailToUse = email.trim() || `${phone.replace(/[\s\-\+]/g, "")}@phone.checkin.app`;
    const passwordToUse = password || crypto.randomUUID();

    setLoading(true);
    const { data, error } = await signUp(emailToUse, passwordToUse, { full_name: fullName, app_role: selectedRole || "user", phone: phone.replace(/\s/g, ""), date_of_birth: dob || "", guardians: guardianRows });
    if (error) {
      setLoading(false);
      return toast.error("Registration failed", { description: error.message });
    }

    const guardiansWithEmail = guardianRows.filter(g => g.guardian_email);
    if (selectedRole === "user") {
      for (const g of guardiansWithEmail) if (g.guardian_email) sendGuardianInvite(g.guardian_email, g.guardian_name, fullName, g.relation || "");
    }
    setSentGuardianCount(guardiansWithEmail.length);

    if (selectedRole === "guardian" && data?.user?.id) {
      await supabase.rpc("link_guardian_user_id");
      const nominationToken = searchParams.get("token");
      if (nominationToken) {
        try { await supabase.functions.invoke("guardian-nomination-response", { body: { token: nominationToken, action: "accept" } }); } catch (e) { console.error(e); }
      }
    }
    setLoading(false);
    setRegistrationComplete(true);
  };

  const handleInstallClick = async () => {
    if (canInstall) await installApp();
    else navigate("/install");
  };

  // --- BLOCKED ---
  if (nominationBlocked) {
    return (
      <div className="dark min-h-screen bg-[#08111F] text-auth-text-1 font-sans px-4 py-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-[320px] flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-auth-amber-soft border-[1.5px] border-[#F5A6234D] flex items-center justify-center text-[28px] mb-4">🔒</div>
          <h1 className="text-[22px] font-bold text-center tracking-tight mb-1.5">No invitation found</h1>
          <div className="text-[14px] text-auth-text-2 text-center mb-6">Your phone number hasn't been nominated as a guardian yet.</div>

          <div className="bg-navy-card border border-auth-border-hi rounded-2xl p-3.5 mb-5 w-full">
            <div className="text-[12px] font-semibold text-auth-text-2 mb-2.5 uppercase tracking-wide">How to get invited</div>
            <div className="flex gap-2.5 items-start mb-2">
              <div className="w-5 h-5 rounded-full bg-auth-amber-soft border border-[#F5A6234D] flex items-center justify-center text-[11px] font-bold text-auth-amber shrink-0">1</div>
              <div className="text-[13px] text-auth-text-2 leading-relaxed">Ask the person you want to protect to open Check-iN</div>
            </div>
            <div className="flex gap-2.5 items-start mb-2">
              <div className="w-5 h-5 rounded-full bg-auth-amber-soft border border-[#F5A6234D] flex items-center justify-center text-[11px] font-bold text-auth-amber shrink-0">2</div>
              <div className="text-[13px] text-auth-text-2 leading-relaxed">They go to <strong className="text-auth-text-1">Settings → Guardians</strong> and add your phone</div>
            </div>
            <div className="flex gap-2.5 items-start">
              <div className="w-5 h-5 rounded-full bg-auth-amber-soft border border-[#F5A6234D] flex items-center justify-center text-[11px] font-bold text-auth-amber shrink-0">3</div>
              <div className="text-[13px] text-auth-text-2 leading-relaxed">You'll receive an SMS/WhatsApp invite link — use it to register</div>
            </div>
          </div>

          <div className="w-full flex flex-col gap-2.5">
            <button onClick={() => navigate("/login")} className="w-full bg-auth-green text-[#0A1525] text-[17px] font-bold py-4 rounded-2xl">Got it — go to Sign In</button>
            <div className="text-[13px] text-auth-text-3 text-center mt-1.5 cursor-pointer" onClick={() => { setNominationBlocked(false); setStep(1); setSelectedRole(null); }}>
              Registering for yourself? <span className="text-auth-green font-semibold">Switch to User</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- SUCCESS ---
  if (registrationComplete) {
    return (
      <div className="dark min-h-screen bg-[#08111F] text-auth-text-1 font-sans px-4 py-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-[320px] flex flex-col items-center">
          <div className="w-[72px] h-[72px] rounded-full bg-auth-green-glow border-[1.5px] border-[#2ECC8A66] flex items-center justify-center text-[32px] mb-5">
            {selectedRole === "user" ? "✅" : "🛡️"}
          </div>
          
          <h1 className="text-[22px] font-bold text-center tracking-tight mb-1.5">
            {selectedRole === "user" ? `You're all set,\n${fullName.split(" ")[0]}!` : `Guardian account\nready, ${fullName.split(" ")[0]}!`}
          </h1>
          <div className="text-[14px] text-auth-text-2 text-center mb-6 leading-relaxed">
            {selectedRole === "user" 
              ? "Welcome to Check-iN. Taking you to your dashboard now." 
              : "You're now protecting your ward. Taking you to your Guardian dashboard."}
          </div>

          <div className="w-full flex flex-col gap-2 mb-6">
            <div className="bg-navy-card border border-auth-border-hi rounded-[10px] p-3 flex items-center gap-2.5">
              <div className="text-[16px] shrink-0">📱</div>
              <div className="text-[13px] text-auth-text-2 leading-relaxed">
                <strong className="text-auth-text-1">Phone verified</strong> — sign in anytime with an OTP
              </div>
            </div>
            
            {selectedRole === "user" && guardians[0]?.name && (
              <div className="bg-navy-card border border-auth-border-hi rounded-[10px] p-3 flex items-center gap-2.5">
                <div className="text-[16px] shrink-0">👨‍👧</div>
                <div className="text-[13px] text-auth-text-2 leading-relaxed">
                  <strong className="text-auth-text-1">{guardians[0].name.split(" ")[0]}</strong> has been notified as your guardian
                </div>
              </div>
            )}
            
            {selectedRole === "guardian" && (
              <div className="bg-navy-card border border-auth-border-hi rounded-[10px] p-3 flex items-center gap-2.5">
                <div className="text-[16px] shrink-0">📍</div>
                <div className="text-[13px] text-auth-text-2 leading-relaxed">
                  <strong className="text-auth-text-1">Live location</strong> access is now active during emergencies
                </div>
              </div>
            )}

            {!isInstalled && (
              <div className="bg-navy-card border border-auth-border-hi rounded-[10px] p-3 flex items-center gap-2.5">
                <div className="text-[16px] shrink-0">📲</div>
                <div className="text-[13px] text-auth-text-2 leading-relaxed">
                  Install Check-iN for instant SOS alerts when the app is closed
                </div>
              </div>
            )}
          </div>

          <div className="w-full flex flex-col gap-2.5 mt-auto">
            <button onClick={() => navigate("/dashboard")} className="w-full bg-auth-green text-[#0A1525] text-[17px] font-bold py-4 rounded-2xl">
              {selectedRole === "user" ? "Go to my dashboard ›" : "Open Guardian dashboard ›"}
            </button>
            {!isInstalled && (
              <button onClick={handleInstallClick} className="w-full bg-transparent text-auth-green text-[14px] font-semibold py-3 rounded-2xl">
                Install app on this phone
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- STEP 1: ROLE ---
  if (step === 1) {
    return (
      <div className="dark min-h-screen bg-[#08111F] text-auth-text-1 font-sans px-4 py-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-[320px] flex flex-col">
          <div className="text-[11px] text-auth-text-3 font-semibold tracking-widest uppercase text-center mb-2">Create account</div>
          <h1 className="text-[22px] font-bold text-center tracking-tight mb-6">How will you use<br/>Check-iN?</h1>

          <button 
            onClick={() => handleRoleSelect("user")}
            className={`w-full bg-navy-card border-[1.5px] rounded-2xl p-4 mb-2.5 flex items-start gap-3.5 transition-colors text-left ${selectedRole === "user" ? "border-auth-green bg-auth-green-glow/20" : "border-auth-border hover:border-auth-green hover:bg-auth-green-glow/5"}`}
          >
            <div className="w-11 h-11 rounded-xl bg-navy-soft flex items-center justify-center text-[20px] shrink-0">🧓</div>
            <div>
              <div className="text-[15px] font-semibold text-auth-text-1 mb-[3px]">To protect myself</div>
              <div className="text-[12px] text-auth-text-2 leading-relaxed mb-1.5">Set up daily check-ins and invite family to watch over me</div>
              <div className="text-[11px] italic text-auth-green">← Seniors & lone dwellers tap here</div>
            </div>
          </button>

          <button 
            onClick={() => handleRoleSelect("guardian")}
            className={`w-full bg-navy-card border-[1.5px] rounded-2xl p-4 mb-2.5 flex items-start gap-3.5 transition-colors text-left ${selectedRole === "guardian" ? "border-auth-green bg-auth-green-glow/20" : "border-auth-border hover:border-auth-green hover:bg-auth-green-glow/5"}`}
          >
            <div className="w-11 h-11 rounded-xl bg-navy-soft flex items-center justify-center text-[20px] shrink-0">👨‍👧</div>
            <div>
              <div className="text-[15px] font-semibold text-auth-text-1 mb-[3px]">To protect someone I love</div>
              <div className="text-[12px] text-auth-text-2 leading-relaxed mb-1.5">Monitor a family member or ward as their Guardian</div>
              {selectedRole === "guardian" && <div className="text-[11px] italic text-auth-green">← Selected</div>}
              {selectedRole !== "guardian" && <div className="text-[11px] italic text-auth-text-3">← Family & caregivers tap here</div>}
            </div>
          </button>

          {selectedRole === "guardian" && (
            <div className="bg-auth-amber-soft border border-[#F5A62340] rounded-[10px] p-3 mb-4 flex items-start gap-2.5 mt-2 animate-in fade-in slide-in-from-top-4">
              <div className="text-[16px] shrink-0 mt-[1px]">⚠️</div>
              <div className="text-[12px] text-[#E8C27A] leading-relaxed">
                <strong className="text-auth-amber">You'll need an invitation</strong> from the person you're protecting before you can create a Guardian account. Ask them to add your phone in Settings → Guardians.
              </div>
            </div>
          )}

          <div className="mt-auto pt-6 flex flex-col gap-3">
            {selectedRole === "guardian" && (
              <button onClick={() => setStep(2)} className="w-full bg-auth-green text-[#0A1525] text-[17px] font-bold py-4 rounded-2xl">
                I have an invitation — continue ›
              </button>
            )}
            <div className="text-center text-[13px] text-auth-text-3 cursor-pointer" onClick={() => navigate("/login")}>
              Already have an account? <span className="text-auth-green font-semibold">Sign in</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PROGRESS HEADER COMPONENT
  const ProgressHeader = () => (
    <div className="flex items-center gap-2.5 mb-5 mt-2">
      <button onClick={handleBack} className="w-8 h-8 rounded-lg bg-navy-mid border border-auth-border-hi flex items-center justify-center text-auth-text-2 text-[14px]">‹</button>
      <div className="flex-1 h-1 bg-navy-soft rounded-full overflow-hidden">
        <div className="h-full bg-auth-green transition-all duration-300" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="text-[11px] text-auth-text-3 whitespace-nowrap">Step {step} / {totalSteps}</div>
    </div>
  );

  // --- STEP 2: DETAILS ---
  if (step === 2) {
    return (
      <div className="dark min-h-screen bg-[#08111F] text-auth-text-1 font-sans px-4 py-6 flex flex-col items-center">
        <div className="w-full max-w-[320px] flex-1 flex flex-col pt-4">
          <ProgressHeader />
          <h1 className="text-[22px] font-bold tracking-tight mb-1">{selectedRole === "guardian" ? "Guardian details" : "Your details"}</h1>
          <div className="text-[14px] text-auth-text-2 mb-6">{selectedRole === "guardian" ? "Set up your guardian account" : "Tell us about yourself"}</div>

          <div className="flex flex-col gap-3.5 mb-2">
            <div>
              <label className="block text-[12px] font-semibold text-auth-text-2 tracking-wide uppercase mb-1.5">Your full name *</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-navy-mid border border-auth-border-hi rounded-[10px] p-[13px] text-auth-text-1 text-[16px] outline-none focus:border-auth-green" />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-auth-text-2 tracking-wide uppercase mb-1.5">Your phone number *</label>
              <div className="bg-navy-mid border border-auth-border-hi rounded-xl p-1">
                <PhoneInput value={phone} onChange={setPhone} placeholder="98765 43210" className="border-0 shadow-none bg-transparent h-12" />
              </div>
              {selectedRole === "guardian" && <div className="text-[11px] text-auth-text-2 mt-1.5">Must match the number the ward invited</div>}
            </div>

            {selectedRole === "user" && (
              <div>
                <label className="block text-[12px] font-semibold text-auth-text-2 tracking-wide uppercase mb-1.5">Date of birth</label>
                <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full bg-navy-mid border border-auth-border-hi rounded-[10px] p-[13px] text-auth-text-1 text-[16px] outline-none focus:border-auth-green [color-scheme:dark]" />
              </div>
            )}

            <div 
              className="flex items-center gap-2 py-2.5 mt-1 border-t border-auth-border cursor-pointer text-auth-green text-[13px] font-medium"
              onClick={() => setShowEmailSection(!showEmailSection)}
            >
              <span>{showEmailSection ? "-" : "+"}</span> Add email for alerts <span className="ml-auto text-[11px] text-auth-text-3 font-normal">Optional</span>
            </div>

            {showEmailSection && (
              <div className="flex flex-col gap-3.5 animate-in slide-in-from-top-2">
                <div>
                  <label className="block text-[12px] font-semibold text-auth-text-2 tracking-wide uppercase mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-navy-mid border border-auth-border-hi rounded-[10px] p-[13px] text-auth-text-1 text-[16px] outline-none focus:border-auth-green" />
                </div>
                {email && (
                  <div>
                    <label className="block text-[12px] font-semibold text-auth-text-2 tracking-wide uppercase mb-1.5">Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-navy-mid border border-auth-border-hi rounded-[10px] p-[13px] text-auth-text-1 text-[16px] outline-none focus:border-auth-green" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-auto pt-6 flex flex-col gap-2.5">
            {selectedRole === "user" && (
              <>
                <div className="flex items-center gap-2.5 text-auth-text-3 text-[12px] tracking-wide mb-1.5">
                  <div className="flex-1 h-px bg-auth-border" /> or sign up faster <div className="flex-1 h-px bg-auth-border" />
                </div>
                <button onClick={handleGoogleSignIn} disabled={googleLoading} className="w-full bg-navy-mid border border-auth-border-hi text-auth-text-1 text-[14px] font-medium py-[13px] rounded-2xl flex items-center justify-center gap-2.5">
                  <GoogleIcon /> {googleLoading ? "Connecting..." : "Continue with Google"}
                </button>
              </>
            )}
            <button onClick={handleDetailsNext} className="w-full bg-auth-green text-[#0A1525] text-[17px] font-bold py-4 rounded-2xl mt-0.5">
              Next — Verify phone ›
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- STEP 3: OTP ---
  if (step === 3) {
    return (
      <div className="dark min-h-screen bg-[#08111F] text-auth-text-1 font-sans px-4 py-6 flex flex-col items-center">
        <div className="w-full max-w-[320px] flex-1 flex flex-col pt-4">
          <ProgressHeader />
          <h1 className="text-[22px] font-bold tracking-tight mb-1">Verify your<br/>phone</h1>
          <div className="text-[14px] text-auth-text-2 mb-5">We sent a 6-digit code to<br/><strong className="text-auth-text-1">{phone}</strong></div>
          <OtpVerification phone={phone.replace(/[\s\-\+]/g, "")} purpose="register" onVerified={handleOtpVerified} onCancel={handleOtpCancel} />
        </div>
      </div>
    );
  }

  // --- STEP 4: GUARDIAN NOMINATION (User only) ---
  if (step === 4) {
    return (
      <div className="dark min-h-screen bg-[#08111F] text-auth-text-1 font-sans px-4 py-6 flex flex-col items-center overflow-y-auto">
        <div className="w-full max-w-[320px] flex-1 flex flex-col pt-4">
          <ProgressHeader />
          <h1 className="text-[22px] font-bold tracking-tight mb-1">Nominate your<br/>guardian</h1>
          <div className="text-[14px] text-auth-text-2 mb-6 leading-relaxed">At least 1 required. They'll be alerted if you miss a check-in.</div>

          <div className="flex flex-col gap-2.5 flex-1">
            {guardians.map((g, i) => (
              <div key={i} className="bg-navy-card border border-auth-border-hi rounded-[16px] p-3.5 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-auth-green bg-auth-green-glow px-2 py-0.5 rounded-full tracking-wide uppercase">
                    {i === 0 ? "Primary Guardian" : `Guardian ${i + 1}`}
                  </span>
                  {i > 0 && <button onClick={() => removeGuardian(i)} className="text-auth-text-3 hover:text-auth-red text-[16px]">✕</button>}
                </div>
                
                <div className="flex flex-col gap-2">
                  <input type="text" placeholder="👤 Guardian Name" value={g.name} onChange={e => updateGuardian(i, "name", e.target.value)} className="w-full bg-navy-mid border border-auth-border rounded-[10px] px-3 py-[13px] text-[14px] text-auth-text-1 placeholder:text-auth-text-3 outline-none focus:border-auth-green" />
                  
                  <div className="bg-navy-mid border border-auth-border rounded-[10px] p-1 focus-within:border-auth-green">
                    <PhoneInput value={g.phone} onChange={val => updateGuardian(i, "phone", val)} placeholder="📱 Phone Number" className="h-10 border-0 shadow-none bg-transparent" />
                  </div>

                  <input type="email" placeholder="✉️ Email for alerts (optional)" value={g.email} onChange={e => updateGuardian(i, "email", e.target.value)} className="w-full bg-navy-mid border border-auth-border rounded-[10px] px-3 py-[13px] text-[14px] text-auth-text-1 placeholder:text-auth-text-3 outline-none focus:border-auth-green" />
                  
                  <select value={g.relation} onChange={e => updateGuardian(i, "relation", e.target.value)} className="w-full bg-navy-mid border border-auth-border rounded-[10px] px-3 py-[13px] text-[14px] text-auth-text-1 placeholder:text-auth-text-3 outline-none focus:border-auth-green appearance-none">
                    <option value="" disabled>🔗 Relation (e.g. Son, Daughter)</option>
                    <option value="spouse">Spouse</option>
                    <option value="son">Son</option>
                    <option value="daughter">Daughter</option>
                    <option value="sibling">Sibling</option>
                    <option value="friend">Friend</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            ))}

            {guardians.length < 5 && (
              <button onClick={addGuardian} className="w-full bg-transparent border-[1.5px] border-dashed border-auth-green/30 text-auth-green text-[13px] font-semibold py-3 rounded-[16px] flex items-center justify-center gap-1.5 mb-2 mt-1">
                + Add another guardian ({guardians.length}/5)
              </button>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <button disabled={loading} onClick={handleSubmit} className="w-full bg-auth-green text-[#0A1525] text-[17px] font-bold py-4 rounded-2xl">
              {loading ? "Creating..." : "Create my account ›"}
            </button>
            <div className="text-center text-[13px] text-auth-text-3 cursor-pointer mt-1" onClick={handleSubmit}>
              <span className="text-auth-green font-semibold">Skip</span> — add guardians later in Settings
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Register;
