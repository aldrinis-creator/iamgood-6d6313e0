import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, Video, History, Play, Square, Phone, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const TeleConsult = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordMode, setRecordMode] = useState<"audio" | "video">("audio");

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      toast.success("Recording saved");
    } else {
      setIsRecording(true);
      toast.info("Recording started");
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="record">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="record" className="text-xs gap-1"><Mic className="w-3 h-3" /> Record</TabsTrigger>
          <TabsTrigger value="video" className="text-xs gap-1"><Video className="w-3 h-3" /> Video Call</TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1"><History className="w-3 h-3" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="space-y-3">
          <Card>
            <CardContent className="p-4 text-center space-y-4">
              <h3 className="font-semibold text-sm">Record Consultation</h3>
              <p className="text-xs text-muted-foreground">Record your doctor consultation for AI transcription and summary.</p>

              <div className="flex justify-center gap-2">
                <Button variant={recordMode === "audio" ? "default" : "outline"} size="sm" onClick={() => setRecordMode("audio")}>
                  <Mic className="w-3 h-3 mr-1" /> Audio
                </Button>
                <Button variant={recordMode === "video" ? "default" : "outline"} size="sm" onClick={() => setRecordMode("video")}>
                  <Video className="w-3 h-3 mr-1" /> Video
                </Button>
              </div>

              <button
                onClick={toggleRecording}
                className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-all ${
                  isRecording ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-primary text-primary-foreground"
                }`}
              >
                {isRecording ? <Square className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>
              <p className="text-xs text-muted-foreground">
                {isRecording ? "Recording... Tap to stop" : "Tap to start recording"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground text-center">
                AI transcription and summary will appear here after recording. Coming soon in Phase 2.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="video" className="space-y-3">
          <Card>
            <CardContent className="p-4 text-center space-y-4">
              <Video className="w-12 h-12 text-primary mx-auto" />
              <h3 className="font-semibold">Video Consultation</h3>
              <p className="text-sm text-muted-foreground">Connect with a doctor via video call for remote consultation.</p>
              <Button className="w-full" disabled>
                <Phone className="w-4 h-4 mr-2" /> Start Video Call
              </Button>
              <p className="text-xs text-muted-foreground">Coming soon — Integration with telemedicine partners</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          <Card>
            <CardContent className="p-4 text-center py-8">
              <History className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No consultation history yet</p>
              <p className="text-xs text-muted-foreground mt-1">Your recorded consultations will appear here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Always obtain consent before recording consultations. Recordings are stored securely on your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeleConsult;
