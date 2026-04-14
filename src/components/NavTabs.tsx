import { Home, Calendar, Heart, HelpCircle, Settings, Bell, FileText, User, MessageCircle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTodayAppointments } from "@/hooks/useTodayAppointments";
import useRefillDue from "@/hooks/useRefillDue";

const NavTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useApp();
  const { session } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const todayApptCount = useTodayAppointments();
  const refillDue = useRefillDue();

  useEffect(() => {
    if (role !== "guardian" || !session?.user?.id) return;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false);
      setUnreadCount(count || 0);
    };

    fetchUnread();

    const channel = supabase
      .channel("guardian-nav-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${session!.user!.id}` },
        () => fetchUnread()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [role, session?.user?.id]);

  const [unreadPings, setUnreadPings] = useState(0);

  useEffect(() => {
    if (role !== "user" || !session?.user?.id) return;

    const fetchUnreadPings = async () => {
      const { count } = await supabase
        .from("guardian_pings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("read", false);
      setUnreadPings(count || 0);
    };

    fetchUnreadPings();

    const pingChannel = supabase
      .channel("user-nav-pings")
      .on("postgres_changes", { event: "*", schema: "public", table: "guardian_pings", filter: `user_id=eq.${session!.user!.id}` }, () => fetchUnreadPings())
      .subscribe();

    return () => { supabase.removeChannel(pingChannel); };
  }, [role, session?.user?.id]);

  const userTabs = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: Calendar, label: "Appointments", path: "/appointments", badge: todayApptCount },
    { icon: MessageCircle, label: "Messages", path: "/messages", badge: unreadPings },
    { icon: Heart, label: "My Health", path: "/my-health", badge: refillDue ? 1 : 0 },
    { icon: HelpCircle, label: "Help", path: "/help" },
  ];

  const [unreadReplies, setUnreadReplies] = useState(0);

  useEffect(() => {
    if (role !== "guardian" || !session?.user?.id) return;

    const fetchUnreadReplies = async () => {
      const { count } = await supabase
        .from("guardian_pings")
        .select("*", { count: "exact", head: true })
        .eq("guardian_user_id", session.user.id)
        .not("reply_message", "is", null)
        .eq("guardian_read", false);
      setUnreadReplies(count || 0);
    };

    fetchUnreadReplies();

    const replyChannel = supabase
      .channel("guardian-nav-replies")
      .on("postgres_changes", { event: "*", schema: "public", table: "guardian_pings", filter: `guardian_user_id=eq.${session!.user!.id}` }, () => fetchUnreadReplies())
      .subscribe();

    return () => { supabase.removeChannel(replyChannel); };
  }, [role, session?.user?.id]);

  const guardianTabs = [
    { icon: User, label: "My User", path: "/guardian", badge: unreadCount },
    { icon: Bell, label: "Alerts", path: "/guardian/alerts" },
    { icon: FileText, label: "Reports", path: "/guardian/reports" },
    { icon: MessageCircle, label: "Messages", path: "/guardian/messages", badge: unreadReplies },
    { icon: Settings, label: "Settings", path: "/guardian-settings" },
  ];

  const tabs = role === "guardian" ? guardianTabs : userTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
      <div className="max-w-md mx-auto flex">
        {tabs.map((tab, tabIdx) => {
          const isActive = location.pathname === tab.path;
          const badge = "badge" in tab ? (tab as any).badge : 0;
          return (
            <button
              key={`${tab.path}-${tabIdx}`}
              onClick={() => navigate(tab.path)}
              className={`flex-1 flex flex-col items-center py-2 px-1 text-xs transition-colors relative ${
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <tab.icon className={`w-5 h-5 mb-1 ${isActive ? "text-primary" : ""} ${badge > 0 && (tab.label === "Appointments" || tab.label === "My Health") ? "text-destructive" : ""}`} />
                {badge > 0 && (
                  <span className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center ${(tab.label === "Appointments" || tab.label === "My Health") ? "animate-pulse shadow-[0_0_8px_hsl(var(--destructive))]" : "animate-pulse"}`}>
                    {tab.label === "My Health" ? "!" : badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default NavTabs;
