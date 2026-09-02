import { User, LogOut, Settings, UserCircle, Wrench, Send, CalendarDays } from "lucide-react";
import NotificationCenter from "@/components/NotificationCenter";
import AQIWidget from "@/components/AQIWidget";
import AccessibilityMenu from "@/components/AccessibilityMenu";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getISTHour } from "@/lib/istTime";
import AvatarImage from "@/components/AvatarImage";
import { useGuardianLink } from "@/hooks/useGuardianLink";
import { cn } from "@/lib/utils";


const AppHeader = () => {
  const { userName, role } = useApp();
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isGuardianLinked } = useGuardianLink();
  // Dual-role: their own 'user' account AND at least one guardian link.
  const showViewSwitcher = profile?.role === "user" && isGuardianLinked;
  const guardianViewActive = location.pathname.startsWith("/guardian");
  const avatarUrl = (profile as any)?.avatar_url;


  const getGreeting = () => {
    const hour = getISTHour();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <header className="bg-background text-foreground px-4 pt-6 pb-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13px] text-muted-foreground font-medium">{getGreeting()},</div>
          <div className="text-[22px] font-bold text-foreground tracking-tight">{userName}</div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <AQIWidget role={role} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Open profile menu"
                className="w-10 h-10 rounded-full bg-navy-card border border-white/5 flex items-center justify-center overflow-hidden shadow-sm relative"
              >
                <AvatarImage
                  value={avatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  fallback={<User className="w-5 h-5 text-muted-foreground" />}
                />

              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              {role !== "guardian" && (
                <DropdownMenuItem onClick={() => navigate("/services")}>
                  <Wrench className="w-4 h-4 mr-2" /> Services
                </DropdownMenuItem>
              )}
              {role === "guardian" && (
                <DropdownMenuItem onClick={() => navigate("/guardian/appointments")}>
                  <CalendarDays className="w-4 h-4 mr-2" /> Appointments
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate("/my-profile")}>
                <UserCircle className="w-4 h-4 mr-2" /> My Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/contact-us")}>
                <Send className="w-4 h-4 mr-2" /> Contact Us
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <AccessibilityMenu renderAsMenuItem={true} />
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(role === "guardian" ? "/guardian-settings" : "/settings")}>
                <Settings className="w-4 h-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => { await signOut(); navigate("/login"); }}>
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

    </header>
  );
};

export default AppHeader;
