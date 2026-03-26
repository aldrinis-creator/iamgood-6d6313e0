import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart } from "lucide-react";

const PRESET_RESPONSES = [
  "I'm fine 👍",
  "Feeling tired 😴",
  "Need a break 🛑",
  "All good, enjoying the ride 🚗",
];

interface JourneyCheckInPopupProps {
  open: boolean;
  onRespond: (response: string) => void;
  onDismiss: () => void;
}

const JourneyCheckInPopup = ({ open, onRespond, onDismiss }: JourneyCheckInPopupProps) => {
  const [customText, setCustomText] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const handlePreset = (text: string) => {
    setCustomText("");
    setShowCustom(false);
    onRespond(text);
  };

  const handleCustomSend = () => {
    if (customText.trim()) {
      onRespond(customText.trim());
      setCustomText("");
      setShowCustom(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary animate-pulse" />
            Are you OK?
          </DialogTitle>
          <DialogDescription>
            Your journey check-in — let your guardian know you're safe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {PRESET_RESPONSES.map((text) => (
            <Button
              key={text}
              variant="outline"
              className="w-full justify-start text-left"
              onClick={() => handlePreset(text)}
            >
              {text}
            </Button>
          ))}

          {!showCustom ? (
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setShowCustom(true)}
            >
              ✍️ Write my own response...
            </Button>
          ) : (
            <div className="space-y-2">
              <Textarea
                placeholder="Type your response..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="min-h-[60px]"
              />
              <Button onClick={handleCustomSend} disabled={!customText.trim()} className="w-full">
                Send Response
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JourneyCheckInPopup;
