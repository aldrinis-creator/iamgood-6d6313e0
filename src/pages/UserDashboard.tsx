import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import CheckInCard from "@/components/CheckInCard";
import HealthPassport from "@/components/HealthPassport";

import AppLayout from "@/components/AppLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const UserDashboard = () => {
  const [sleepMode, setSleepMode] = useState(false);

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        {/* Sleep Mode Toggle */}
        <Card className="bg-primary/5">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {sleepMode ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
              <span className="text-sm font-medium">
                {sleepMode ? "Sleep Mode (Check-iNs Paused)" : "Active Mode"}
              </span>
            </div>
            <Switch checked={sleepMode} onCheckedChange={setSleepMode} />
          </CardContent>
        </Card>

        {/* Check-In Card */}
        {!sleepMode && <CheckInCard />}

        {/* Health Dashboard */}
        <HealthDashboard />

        {/* Health Passport */}
        <HealthPassport />

        {/* How It Works */}
        <Accordion type="single" collapsible>
          <AccordionItem value="how-it-works">
            <AccordionTrigger className="text-accessible font-semibold">
              How Check-iN Works
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-3 items-start">
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <p><strong>Set Your Schedule:</strong> Choose your daily Check-iN times (default: 7AM, 12PM, 7PM).</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <p><strong>Tap the Heart:</strong> When prompted, tap the pulsing heart to confirm you're okay.</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <p><strong>Automatic Alerts:</strong> If you miss a Check-iN, your guardians are notified automatically.</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-7 h-7 rounded-full bg-sos text-sos-foreground flex items-center justify-center text-xs font-bold shrink-0">!</span>
                <p><strong>SOS Anytime:</strong> Press the SOS button for immediate emergency alert with live location sharing.</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* AI Health Companion */}
        <Card className="bg-gradient-to-r from-primary/10 to-success/10 border-0">
          <CardContent className="p-4">
            <h3 className="text-accessible font-semibold mb-2">🤖 AI Health Companion</h3>
            <p className="text-sm text-muted-foreground">
              Check-iN uses AI to learn your daily patterns and detect unusual inactivity.
              Combined with phone-based fall detection, it provides a proactive safety net — even without wearable hardware.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default UserDashboard;
