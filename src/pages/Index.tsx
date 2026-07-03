import { useApp } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import SeoMeta from "@/components/SeoMeta";

const Index = () => {
  const { isLoggedIn, role } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoggedIn) {
      navigate(role === "user" ? "/dashboard" : "/guardian");
    }
  }, [isLoggedIn, role, navigate]);

  return (
    <div className="min-h-screen bg-[#08111F] text-auth-text-1 font-sans px-4 pt-8 pb-16 flex flex-col items-center">
      <SeoMeta
        title="Check-iN — Auth Flow Mockup"
        description="India's medication reminder, elderly care & emergency alert app for seniors."
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
            <div className="text-2xl font-bold tracking-tight text-auth-text-1">Check-iN</div>
            <div className="text-xs text-auth-text-2 mt-0.5">Your personal safety network</div>
          </div>
        </div>

        {/* CARDS */}
        <div className="bg-navy-card border border-auth-border-hi rounded-2xl p-3.5 mb-2.5">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-auth-green-glow flex items-center justify-center text-[15px] shrink-0">🛡️</div>
            <div className="text-sm font-semibold text-auth-text-1 flex items-center">
              For Seniors & Lone Dwellers
              <span className="text-[11px] font-medium text-auth-green bg-auth-green-glow px-2 py-0.5 rounded-full ml-1.5">For you</span>
            </div>
          </div>
          <ul className="flex flex-col gap-1.5 list-none">
            <li className="text-[13px] text-auth-text-2 flex items-center gap-2">
              <div className="w-[5px] h-[5px] rounded-full bg-auth-green opacity-70 shrink-0"></div>
              Scheduled safety check-ins
            </li>
            <li className="text-[13px] text-auth-text-2 flex items-center gap-2">
              <div className="w-[5px] h-[5px] rounded-full bg-auth-green opacity-70 shrink-0"></div>
              One-tap SOS & live location
            </li>
            <li className="text-[13px] text-auth-text-2 flex items-center gap-2">
              <div className="w-[5px] h-[5px] rounded-full bg-auth-green opacity-70 shrink-0"></div>
              Medication reminders & vault
            </li>
          </ul>
        </div>

        <div className="bg-navy-card border border-auth-border-hi rounded-2xl p-3.5 mb-[5vh]">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#4682DC26] flex items-center justify-center text-[15px] shrink-0">👁️</div>
            <div className="text-sm font-semibold text-auth-text-1">For Guardians & Family</div>
          </div>
          <ul className="flex flex-col gap-1.5 list-none">
            <li className="text-[13px] text-auth-text-2 flex items-center gap-2">
              <div className="w-[5px] h-[5px] rounded-full bg-[#4682DC] opacity-70 shrink-0"></div>
              Real-time dashboard & map
            </li>
            <li className="text-[13px] text-auth-text-2 flex items-center gap-2">
              <div className="w-[5px] h-[5px] rounded-full bg-[#4682DC] opacity-70 shrink-0"></div>
              Instant SOS & missed check-in alerts
            </li>
            <li className="text-[13px] text-auth-text-2 flex items-center gap-2">
              <div className="w-[5px] h-[5px] rounded-full bg-[#4682DC] opacity-70 shrink-0"></div>
              WhatsApp + email notifications
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
          <div className="text-center text-[11px] text-auth-text-3 mt-1">Protecting seniors across India 🇮🇳</div>
        </div>

      </div>
    </div>
  );
};

export default Index;
