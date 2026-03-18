import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Heart, Droplets, Flame, AlertTriangle, Pill, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";

interface Guide {
  title: string;
  icon: typeof Heart;
  color: string;
  steps: string[];
}

const guides: Guide[] = [
  {
    title: "CPR",
    icon: Heart,
    color: "text-destructive bg-destructive/10",
    steps: [
      "Check if the person is responsive — tap shoulders and shout.",
      "Call 112 or ask someone nearby to call.",
      "Place the heel of one hand on the center of the chest, interlock fingers.",
      "Push hard and fast — 5-6 cm deep, 100-120 compressions per minute.",
      "After 30 compressions, give 2 rescue breaths (tilt head, lift chin).",
      "Continue 30:2 cycle until help arrives or the person responds.",
    ],
  },
  {
    title: "Severe Bleeding",
    icon: Droplets,
    color: "text-destructive bg-destructive/10",
    steps: [
      "Apply firm direct pressure with a clean cloth or bandage.",
      "Keep pressing — do NOT remove the cloth even if blood soaks through.",
      "Elevate the injured limb above heart level if possible.",
      "If bleeding doesn't stop, apply pressure to the nearest pressure point.",
      "Call 112 for severe or uncontrolled bleeding.",
      "Keep the person warm and calm until help arrives.",
    ],
  },
  {
    title: "Burns",
    icon: Flame,
    color: "text-orange-500 bg-orange-500/10",
    steps: [
      "Cool the burn under running cold water for at least 20 minutes.",
      "Remove jewellery or clothing near the burn (not if stuck to skin).",
      "Cover with a clean, non-fluffy material (cling film works well).",
      "Do NOT apply ice, butter, toothpaste, or creams.",
      "For chemical burns, remove contaminated clothing and rinse with water.",
      "Seek medical help for burns larger than a palm or on face/joints/hands.",
    ],
  },
  {
    title: "Allergic Reaction",
    icon: AlertTriangle,
    color: "text-yellow-600 bg-yellow-600/10",
    steps: [
      "Identify and remove the allergen if possible.",
      "If the person has an EpiPen, help them use it on the outer thigh.",
      "Call 112 if there are signs of anaphylaxis (swelling, difficulty breathing).",
      "Help the person sit upright if breathing is difficult.",
      "If they become unconscious, place in recovery position.",
      "Give antihistamine tablets if available and they can swallow.",
    ],
  },
  {
    title: "Heart Attack",
    icon: Heart,
    color: "text-destructive bg-destructive/10",
    steps: [
      "Call 112 immediately — every minute counts.",
      "Help the person sit in a comfortable position (W-position on floor).",
      "Give 300mg Aspirin to chew (if not allergic).",
      "If they have GTN spray/tablet prescribed, help them take it.",
      "Loosen tight clothing around neck and chest.",
      "Be ready to start CPR if they become unresponsive.",
    ],
  },
  {
    title: "Poisoning",
    icon: Pill,
    color: "text-purple-500 bg-purple-500/10",
    steps: [
      "Call the Poison Helpline: 1800-11-6117 (AIIMS).",
      "Try to identify what was consumed, how much, and when.",
      "Do NOT make the person vomit unless instructed by medical professionals.",
      "If the poison is on the skin, remove contaminated clothing and wash.",
      "If inhaled, move to fresh air immediately.",
      "Save any containers, labels, or vomit samples for medical team.",
    ],
  },
];

const EmergencyFirstAid = () => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Emergency Banner */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-4 flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-destructive">Medical Emergency?</p>
            <p className="text-xs text-muted-foreground">Call emergency services immediately</p>
          </div>
          <Button size="sm" className="bg-destructive hover:bg-destructive/90 shrink-0" onClick={() => window.open("tel:112")}>
            <Phone className="w-4 h-4 mr-1" /> 112
          </Button>
        </CardContent>
      </Card>

      {/* Guides Grid */}
      <div className="space-y-2">
        {guides.map((guide) => (
          <Card key={guide.title} className="overflow-hidden">
            <button
              className="w-full p-3 flex items-center gap-3 text-left"
              onClick={() => setExpanded(expanded === guide.title ? null : guide.title)}
            >
              <div className={`w-10 h-10 rounded-full ${guide.color} flex items-center justify-center shrink-0`}>
                <guide.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium flex-1">{guide.title}</span>
              {expanded === guide.title ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {expanded === guide.title && (
              <CardContent className="px-4 pb-4 pt-0">
                <ol className="space-y-2">
                  {guide.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-semibold">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default EmergencyFirstAid;
