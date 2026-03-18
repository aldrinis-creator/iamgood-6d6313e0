import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Clock, MapPin, Smartphone, Plus, Trash2, Bell, Volume2, BellRing } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { type AudioAlertMode, getAudioMode, setAudioMode, testAlert } from "@/lib/audioAlerts";
import usePushSubscription from "@/hooks/usePushSubscription";

const PushNotificationCard = () => {
  const { isSubscribed, loading, supported, subscribe, unsubscribe } = usePushSubscription();

  if (!supported) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <BellRing className="w-5 h-5 text-primary" />
          Push Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Enable push reminders</Label>
          <Switch
            checked={isSubscribed}
            disabled={loading}
            onCheckedChange={(checked) => (checked ? subscribe() : unsubscribe())}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Receive medication reminders even when the app is in the background or closed.
        </p>
      </CardContent>
    </Card>
  );
};

const Settings = () => {
  const [fallDetection, setFallDetection] = useState(true);
  const [inactivityDetection, setInactivityDetection] = useState(true);
  const [audioMode, setAudioModeState] = useState<AudioAlertMode>(getAudioMode());

  const handleAudioModeChange = (value: string) => {
    const mode = value as AudioAlertMode;
    setAudioModeState(mode);
    setAudioMode(mode);
  };
  const [safeZones, setSafeZones] = useState([
    { name: "Home", address: "Sector 15, Gurugram", radius: "200m" },
    { name: "Pharmacy", address: "MG Road, Gurugram", radius: "100m" },
  ]);

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">Settings</h1>

        {/* Check-In Schedule */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Check-iN Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {["7:00 AM", "12:00 PM", "7:00 PM"].map((time, i) => (
              <div key={time} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">Check-iN {i + 1}</p>
                  <p className="text-xs text-muted-foreground">{time}</p>
                </div>
                <Switch defaultChecked />
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="w-4 h-4 mr-1" /> Add Check-iN Time
            </Button>
          </CardContent>
        </Card>

        {/* Audio Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-primary" />
              Audio Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RadioGroup value={audioMode} onValueChange={handleAudioModeChange} className="space-y-2">
              <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="off" id="audio-off" />
                <Label htmlFor="audio-off" className="text-sm cursor-pointer flex-1">
                  <span className="font-medium">Off</span>
                  <span className="block text-xs text-muted-foreground">No audio reminders</span>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="chime" id="audio-chime" />
                <Label htmlFor="audio-chime" className="text-sm cursor-pointer flex-1">
                  <span className="font-medium">Chime</span>
                  <span className="block text-xs text-muted-foreground">Pleasant three-tone alert sound</span>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="voice" id="audio-voice" />
                <Label htmlFor="audio-voice" className="text-sm cursor-pointer flex-1">
                  <span className="font-medium">Voice</span>
                  <span className="block text-xs text-muted-foreground">Spoken reminder: "It's time for your Check-iN"</span>
                </Label>
              </div>
            </RadioGroup>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={audioMode === "off"}
              onClick={() => testAlert(audioMode)}
            >
              <Volume2 className="w-4 h-4 mr-1" /> Test Sound
            </Button>
            <p className="text-xs text-muted-foreground">
              Audio alerts play when the app is open at check-in times. For best results, keep the app active or install as a home screen app.
            </p>
          </CardContent>
        </Card>

        {/* Push Notifications */}
        <PushNotificationCard />

        {/* Inactivity Detection */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              AI Inactivity Detection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Enable Inactivity Monitoring</Label>
              <Switch checked={inactivityDetection} onCheckedChange={setInactivityDetection} />
            </div>
            <div>
              <Label className="text-sm">Nudge Interval</Label>
              <Select defaultValue="6">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Every 2 hours</SelectItem>
                  <SelectItem value="4">Every 4 hours</SelectItem>
                  <SelectItem value="6">Every 6 hours</SelectItem>
                  <SelectItem value="8">Every 8 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Uses phone accelerometer and screen-on time to detect unusual inactivity patterns.
            </p>
          </CardContent>
        </Card>

        {/* Fall Detection */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5 text-sos" />
              Fall Detection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Enable Fall Detection</Label>
              <Switch checked={fallDetection} onCheckedChange={setFallDetection} />
            </div>
            <p className="text-xs text-muted-foreground">
              Uses your phone's accelerometer to detect sudden impacts consistent with falls.
              When detected, you'll have 30 seconds to cancel before an alert is sent to guardians.
            </p>
          </CardContent>
        </Card>

        {/* Geofencing */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-success" />
              Safe Zones (Geofencing)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {safeZones.map((zone, i) => (
              <div key={zone.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{zone.name}</p>
                  <p className="text-xs text-muted-foreground">{zone.address} • {zone.radius}</p>
                </div>
                <button
                  onClick={() => setSafeZones(safeZones.filter((_, idx) => idx !== i))}
                  className="p-1 text-muted-foreground hover:text-sos"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="w-4 h-4 mr-1" /> Add Safe Zone
            </Button>
            <p className="text-xs text-muted-foreground">
              Pro feature: Receive instant notifications when the user enters or leaves safe zones.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Settings;
