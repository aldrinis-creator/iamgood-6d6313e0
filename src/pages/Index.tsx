import { useApp } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import SeoMeta from "@/components/SeoMeta";
import { captureNominationFromSearch, getPendingNominationToken } from "@/lib/pendingNomination";

const Index = () => {
  const { isLoggedIn, role } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    // The installed PWA starts at "/", which drops ?g=<token>. Capture it before
    // any redirect so an existing account signing in still resumes the invite.
    captureNominationFromSearch(window.location.search);
    const pending = getPendingNominationToken();

    if (isLoggedIn) {
      // Someone with an existing account holding a pending nomination must go
      // through the accept flow (which runs link_guardian_user_id) first.
      if (pending) {
        navigate(`/register?nomination=accept&token=${pending}`, { replace: true });
        return;
      }
      navigate(role === "user" ? "/dashboard" : "/guardian");
      return;
    }
    if (pending) {
      navigate(`/register?nomination=accept&token=${pending}`, { replace: true });
    }
  }, [isLoggedIn, role, navigate]);



  return (
    <div className="min-h-screen bg-[#08111F] text-auth-text-1 font-sans px-4 pt-8 pb-16 flex flex-col items-center safe-top">
      <SeoMeta
        title="Check-iN — Senior Safety & Medication Reminders"
        description="Check-iN helps Indian families care for elderly parents: daily check-ins, medication reminders, one-tap SOS, guardian alerts and a medical vault."
        keywords="medication reminder app, elderly care app, senior safety app"
        canonicalPath="/"
      />


      <div className="w-full max-w-[320px] flex-1 flex flex-col pt-[8vh]">
        
        {/* LOGO SECTION */}
        <div className="flex flex-col items-center gap-3 mb-7">
          <div className="relative w-[72px] h-[72px] flex items-center justify-center">
            <div className="absolute -inset-2 rounded-full border-[1.5px] border-auth-green opacity-35 animate-[pulse_2.4s_ease-in-out_infinite]"></div>
            <div className="absolute -inset-4 rounded-full border border-auth-green opacity-15 animate-[pulse_2.4s_ease-in-out_infinite_0.6s]"></div>
            <div className="w-[72px] h-[72px] rounded-[20px] bg-navy-mid border-[1.5px] border-auth-green/30 flex items-center justify-center z-10">
              <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-9">
                <path d="M18 4L22 8H30V16L34 18L30 20V28H22L18 32L14 28H6V20L2 18L6 16V8H14L18 4Z" stroke="#2ECC8A" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(46,204,138,0.08)"/>
                <path d="M12 18L16 22L24 14" stroke="#2ECC8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-auth-text-1">
              Check-iN
              <span className="sr-only"> — senior safety and medication reminders for Indian families</span>
            </h1>
            <p className="text-xs text-auth-text-2 mt-0.5">Your personal safety network</p>
          </div>

        </div>

        {/* CARDS */}
        <div className="bg-navy-card border border-auth-border-hi rounded-2xl p-3.5 mb-[6vh]">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-auth-green-glow flex items-center justify-center text-[15px] shrink-0">🛡️</div>
            <div className="text-sm font-semibold text-auth-text-1 flex items-center">
              Personal Health & Safety
            </div>
          </div>
          <ul className="flex flex-col gap-2 list-none">
            <li className="text-[13px] text-auth-text-2 flex items-center gap-2.5">
              <div className="w-[5px] h-[5px] rounded-full bg-auth-green opacity-70 shrink-0"></div>
              Scheduled safety check-ins
            </li>
            <li className="text-[13px] text-auth-text-2 flex items-center gap-2.5">
              <div className="w-[5px] h-[5px] rounded-full bg-auth-green opacity-70 shrink-0"></div>
              One-tap SOS & live location
            </li>
            <li className="text-[13px] text-auth-text-2 flex items-center gap-2.5">
              <div className="w-[5px] h-[5px] rounded-full bg-auth-green opacity-70 shrink-0"></div>
              Medication reminders & vault
            </li>
            <li className="text-[13px] text-auth-text-2 flex items-center gap-2.5">
              <div className="w-[5px] h-[5px] rounded-full bg-auth-green opacity-70 shrink-0"></div>
              Invite your family to watch over you
            </li>
          </ul>
        </div>

        {/* BUTTONS */}
        <div className="flex flex-col gap-2.5 mt-auto">
          <button 
            onClick={() => navigate("/register")}
            className="w-full bg-auth-green text-[#0A1525] text-[17px] font-bold py-4 rounded-2xl flex items-center justify-center gap-2 tracking-tight transition-transform active:scale-[0.98]"
          >
            Create account ›
          </button>
          <button 
            onClick={() => navigate("/login")}
            className="w-full bg-transparent text-auth-text-1 text-base font-semibold py-[15px] rounded-2xl border-[1.5px] border-auth-border-hi flex items-center justify-center transition-colors active:bg-auth-border-hi/30"
          >
            Sign in
          </button>
          <div className="text-center text-[11px] text-auth-text-3 mt-4">
            Are you a Guardian? Please tap the link sent to you via SMS/WhatsApp to join.
          </div>
        </div>

      </div>
    </div>
  );
};

export default Index;
