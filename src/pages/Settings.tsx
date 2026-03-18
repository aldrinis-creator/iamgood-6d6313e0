import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  Settings as SettingsIcon, Bell, BellRing, Volume2, MessageSquare, Vibrate,
  Clock, Moon, Star, AlertTriangle, CalendarClock, Users, Globe, Lock, Shield,
  Plus, Trash2, Phone, Mail, CheckCircle, XCircle, HelpCircle, Loader2
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import usePushSubscription from "@/hooks/usePushSubscription";
import { formatDistanceToNow, format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type SettingsTab = "alerts" | "checkin" | "appts" | "guardians" | "language" | "access" | "privacy";

interface Guardian {
  id: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string | null;
  relation: string | null;
  is_primary: boolean;
  status: string;
  nominated_at: string;
  is_vault_nominee: boolean;
}

const Settings = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("alerts");
  const navigate = useNavigate();
  const { session } = useAuth();

  // Alerts state
  const [audioAlerts, setAudioAlerts] = useState(true);
  const [voiceReminders, setVoiceReminders] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [checkInPush, setCheckInPush] = useState(true);
  const [medPush, setMedPush] = useState(true);
  const [guardianPush, setGuardianPush] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);

  // Check-In state
  const [sleepMode, setSleepMode] = useState(true);
  const [nudgeFrequency, setNudgeFrequency] = useState("4");
  const [fallDetection, setFallDetection] = useState(true);

  // Appts state
  const [preAlert, setPreAlert] = useState("15min");

  // Guardians state
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRelation, setNewRelation] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const { isSubscribed, supported } = usePushSubscription();

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "alerts", label: "Alerts" },
    { id: "checkin", label: "Check-In" },
    { id: "appts", label: "Appts" },
    { id: "guardians", label: "Guardians" },
    { id: "language", label: "Language" },
    { id: "access", label: "Access" },
    { id: "privacy", label: "Privacy" },
  ];

  // Fetch guardians
  useEffect(() => {
    if (!session?.user?.id) return;
    const fetchGuardians = async () => {
      const { data } = await supabase
        .from("guardians")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true });
      if (data) setGuardians(data as unknown as Guardian[]);
    };
    fetchGuardians();
  }, [session?.user?.id, activeTab]);

  const addGuardian = async () => {
    if (!session?.user?.id || !newName || !newPhone) {
      toast.error("Name and phone are required");
      return;
    }
    if (guardians.length >= 5) {
      toast.error("Maximum 5 guardians allowed");
      return;
    }
    const { error } = await supabase.from("guardians").insert({
      user_id: session.user.id,
      guardian_name: newName,
      guardian_phone: newPhone,
      guardian_email: newEmail || null,
      relation: newRelation || null,
      is_primary: guardians.length === 0,
      status: "accepted",
      nominated_at: new Date().toISOString(),
      is_vault_nominee: false,
    } as any);
    if (error) {
      toast.error("Failed to add guardian");
    } else {
      toast.success(`${newName} added as Guardian (auto-accepted, 24hr rejection window)`);
      setNewName(""); setNewPhone(""); setNewEmail(""); setNewRelation("");
      setShowAddForm(false);
      // Refresh
      const { data } = await supabase.from("guardians").select("*").eq("user_id", session.user.id).order("created_at");
      if (data) setGuardians(data as unknown as Guardian[]);
    }
  };

  const removeGuardian = async (id: string) => {
    const { error } = await supabase.from("guardians").delete().eq("id", id);
    if (!error) {
      setGuardians(guardians.filter((g) => g.id !== id));
      toast.success("Guardian removed");
    }
  };

  const toggleVaultNominee = async (id: string, current: boolean) => {
    const { error } = await supabase.from("guardians").update({ is_vault_nominee: !current } as any).eq("id", id);
    if (!error) {
      setGuardians(guardians.map((g) => g.id === id ? { ...g, is_vault_nominee: !current } : g));
    }
  };

  const getStatusBadge = (g: Guardian) => {
    const nominated = new Date(g.nominated_at);
    const hoursSince = (Date.now() - nominated.getTime()) / (1000 * 60 * 60);
    
    if (g.status === "rejected") {
      return <Badge variant="destructive" className="text-xs gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
    }
    if (g.status === "accepted" && hoursSince < 24) {
      return <Badge className="bg-warning text-warning-foreground text-xs gap-1"><Clock className="w-3 h-3" /> Pending ({Math.ceil(24 - hoursSince)}h left)</Badge>;
    }
    return <Badge className="bg-success text-success-foreground text-xs gap-1"><CheckCircle className="w-3 h-3" /> Accepted</Badge>;
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            Settings
          </h1>
          <button onClick={() => navigate("/help")} className="text-sm text-primary hover:underline">
            Help
          </button>
        </div>

        {/* Tab grid - 2 rows */}
        <nav className="grid grid-cols-4 gap-1 bg-muted rounded-lg p-1">
          {tabs.slice(0, 4).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-2 rounded-md text-sm font-medium transition-colors text-center ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {tabs.slice(4).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-2 rounded-md text-sm font-medium transition-colors text-center ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* ============ ALERTS TAB ============ */}
        {activeTab === "alerts" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  Notification Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {supported && isSubscribed && (
                  <div className="p-3 rounded-lg bg-success/10 mb-3 space-y-1">
                    <p className="text-sm font-medium text-success flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" /> Notifications Ready
                    </p>
                    <p className="text-xs text-success flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Permission: granted</p>
                    <p className="text-xs text-success flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Service Worker: Active</p>
                  </div>
                )}
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Audio Alerts</p>
                      <p className="text-xs text-muted-foreground">Play a chime when check-in is due</p>
                    </div>
                  </div>
                  <Switch checked={audioAlerts} onCheckedChange={setAudioAlerts} />
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Wellness Voice Reminders</p>
                      <p className="text-xs text-muted-foreground">Spoken nudges when health tasks are incomplete</p>
                    </div>
                  </div>
                  <Switch checked={voiceReminders} onCheckedChange={setVoiceReminders} />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Vibrate className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Vibration & Notifications</p>
                      <p className="text-xs text-muted-foreground">Always enabled for check-in reminders</p>
                    </div>
                  </div>
                  <Switch checked={vibration} onCheckedChange={setVibration} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-primary" />
                  Push Notifications
                </CardTitle>
                <p className="text-xs text-primary">Configure how you receive push notifications</p>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium">Check-In Reminders</p>
                    <p className="text-xs text-muted-foreground">Get reminded when it's time to check in</p>
                  </div>
                  <Switch checked={checkInPush} onCheckedChange={setCheckInPush} />
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium">Medication Reminders</p>
                    <p className="text-xs text-muted-foreground">Get notified when medications are due</p>
                  </div>
                  <Switch checked={medPush} onCheckedChange={setMedPush} />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">Guardian Updates</p>
                    <p className="text-xs text-muted-foreground">Receive updates when guardians respond</p>
                  </div>
                  <Switch checked={guardianPush} onCheckedChange={setGuardianPush} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Weekly Email Report
                </CardTitle>
                <p className="text-xs text-muted-foreground">Receive a consolidated weekly health summary via email every Sunday at 9 AM</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Enable Weekly Report</p>
                    <p className="text-xs text-muted-foreground">Sends check-in, medication, wellness & activity data to you and your guardians</p>
                  </div>
                  <Switch checked={weeklyReport} onCheckedChange={setWeeklyReport} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============ CHECK-IN TAB ============ */}
        {activeTab === "checkin" && (
          <div className="space-y-4">
            {/* Sleep Mode / Check-Out pills */}
            <div className="flex gap-2">
              <Badge
                variant={sleepMode ? "default" : "outline"}
                className="cursor-pointer gap-1.5 px-3 py-1.5"
                onClick={() => setSleepMode(true)}
              >
                <Moon className="w-3.5 h-3.5" /> Sleep Mode {sleepMode && <span className="text-xs">(Active)</span>}
              </Badge>
              <Badge
                variant={!sleepMode ? "default" : "outline"}
                className="cursor-pointer gap-1.5 px-3 py-1.5"
                onClick={() => setSleepMode(false)}
              >
                <Star className="w-3.5 h-3.5" /> Check-Out
              </Badge>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Inactivity Nudge Interval
                </CardTitle>
                <p className="text-xs text-muted-foreground">Choose how frequently you'd like to receive nudges when no activity is detected.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Nudge Frequency</p>
                    <p className="text-xs text-muted-foreground">Alerts will be sent to your guardians if you remain inactive</p>
                  </div>
                  <Select value={nudgeFrequency} onValueChange={setNudgeFrequency}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">Every 2 Hours</SelectItem>
                      <SelectItem value="4">Every 4 Hours (Default)</SelectItem>
                      <SelectItem value="6">Every 6 Hours</SelectItem>
                      <SelectItem value="8">Every 8 Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Fall Detection
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Uses your device's motion sensors to detect potential falls. If a fall is detected and you don't respond within 30 seconds, an SOS alert is sent to your guardians.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Enable Fall Detection</p>
                    <p className="text-xs text-muted-foreground">Monitors accelerometer for sudden falls</p>
                  </div>
                  <Switch checked={fallDetection} onCheckedChange={setFallDetection} />
                </div>
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="text-xs text-foreground">
                    <strong>How it works:</strong> The sensor looks for a free-fall pattern followed by a sudden impact and stillness. If detected, you'll have 30 seconds to confirm you're okay before an SOS is triggered.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============ APPTS TAB ============ */}
        {activeTab === "appts" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-primary" />
                  Appointment Pre-Alert
                </CardTitle>
                <p className="text-xs text-muted-foreground">Choose how early you want to be reminded before an appointment</p>
              </CardHeader>
              <CardContent>
                <RadioGroup value={preAlert} onValueChange={setPreAlert} className="space-y-2">
                  {[
                    { value: "5min", label: "5 minutes before" },
                    { value: "10min", label: "10 minutes before" },
                    { value: "15min", label: "15 minutes before" },
                    { value: "30min", label: "30 minutes before" },
                    { value: "1hour", label: "1 hour before" },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50">
                      <RadioGroupItem value={opt.value} id={`pre-${opt.value}`} />
                      <Label htmlFor={`pre-${opt.value}`} className="text-sm cursor-pointer flex-1">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============ GUARDIANS TAB ============ */}
        {activeTab === "guardians" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Guardians
                </CardTitle>
                <p className="text-xs text-muted-foreground">Guardians receive SOS alerts and can be nominated as Secret Vault nominees</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {guardians.map((g) => (
                  <div key={g.id} className="p-3 rounded-lg border border-border space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{g.guardian_name}</p>
                          {getStatusBadge(g)}
                        </div>
                        {g.guardian_email && <p className="text-xs text-muted-foreground">{g.guardian_email}</p>}
                        <p className="text-xs text-muted-foreground">{g.guardian_phone}</p>
                        {g.relation && <p className="text-xs text-muted-foreground">Relation: {g.relation}</p>}
                      </div>
                      <button onClick={() => removeGuardian(g.id)} className="text-destructive hover:text-destructive/80 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                        <Label className="text-xs">Vault Nominee</Label>
                        <Switch
                          checked={g.is_vault_nominee}
                          onCheckedChange={() => toggleVaultNominee(g.id, g.is_vault_nominee)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="text-xs gap-1">
                          <Phone className="w-3 h-3" /> SMS/WhatsApp
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs gap-1">
                          <Mail className="w-3 h-3" /> Email
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {showAddForm && (
                  <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                    <Input placeholder="Guardian Name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    <Input placeholder="Phone (+91...) *" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                    <Input placeholder="Email (optional)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                    <Input placeholder="Relation (optional)" value={newRelation} onChange={(e) => setNewRelation(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addGuardian} className="flex-1">Add Guardian</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Guardian will be auto-accepted upon nomination. They have 24 hours to reject via SMS/WhatsApp.
                    </p>
                  </div>
                )}

                {guardians.length < 5 && !showAddForm && (
                  <Button variant="outline" className="w-full gap-2" onClick={() => setShowAddForm(true)}>
                    <Plus className="w-4 h-4" /> Add Guardian ({guardians.length}/5)
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============ LANGUAGE TAB ============ */}
        {activeTab === "language" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  App Language
                </CardTitle>
                <p className="text-xs text-muted-foreground">Select your preferred language</p>
              </CardHeader>
              <CardContent>
                <RadioGroup defaultValue="en" className="space-y-2">
                  {[
                    { value: "en", label: "English" },
                    { value: "hi", label: "हिन्दी (Hindi)" },
                    { value: "mr", label: "मराठी (Marathi)" },
                    { value: "ta", label: "தமிழ் (Tamil)" },
                    { value: "bn", label: "বাংলা (Bengali)" },
                    { value: "ml", label: "മലയാളം (Malayalam)" },
                    { value: "kn", label: "ಕನ್ನಡ (Kannada)" },
                    { value: "kok", label: "कोंकणी (Konkani)" },
                    { value: "fr", label: "Français (French)" },
                  ].map((lang) => (
                    <div key={lang.value} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50">
                      <RadioGroupItem value={lang.value} id={`lang-${lang.value}`} />
                      <Label htmlFor={`lang-${lang.value}`} className="text-sm cursor-pointer flex-1">{lang.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============ ACCESS TAB ============ */}
        {activeTab === "access" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  Access & Permissions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium">Location Access</p>
                    <p className="text-xs text-muted-foreground">Required for SOS alerts and safe zones</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium">Camera Access</p>
                    <p className="text-xs text-muted-foreground">Used for Face Scan and document scanning</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">Motion Sensors</p>
                    <p className="text-xs text-muted-foreground">Used for fall detection and activity tracking</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============ PRIVACY TAB ============ */}
        {activeTab === "privacy" && (
          <PrivacyTab session={session} navigate={navigate} />
        )}
      </div>
    </AppLayout>
  );
};

export default Settings;
