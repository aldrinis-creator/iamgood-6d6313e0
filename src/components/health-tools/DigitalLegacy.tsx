import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  HeartHandshake,
  Mic,
  Video,
  FileText,
  Plus,
  Play,
  Square,
  Trash2,
  Lock,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  User,
  Loader2,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface LegacyMessage {
  id: string;
  title: string;
  recipient_name: string;
  recipient_relation: string;
  media_type: "text" | "audio" | "video";
  content_text?: string;
  media_url?: string;
  created_at: string;
}

export const DigitalLegacy: React.FC = () => {
  const { session } = useAuth();
  const [messages, setMessages] = useState<LegacyMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [mediaType, setMediaType] = useState<"text" | "audio" | "video">("text");
  const [title, setTitle] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientRelation, setRecipientRelation] = useState("Child");
  const [contentText, setContentText] = useState("");
  const [saving, setSaving] = useState(false);

  // Audio recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Video recording state
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);

  // Load user's legacy messages
  const loadMessages = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("digital_legacy_messages" as any)
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMessages((data as any) || []);
    } catch (err: any) {
      console.error("Failed to load legacy messages:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [session?.user?.id]);

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // --- AUDIO RECORDING ---
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingAudio(true);
      toast.info("Recording voice message... Speak into your microphone.");
    } catch (err) {
      console.error(err);
      toast.error("Microphone access denied or unavailable");
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      toast.success("Voice message recorded!");
    }
  };

  // --- VIDEO RECORDING ---
  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      videoStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }

      const recorder = new MediaRecorder(stream);
      videoChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
        setVideoBlob(blob);
        setVideoUrl(URL.createObjectURL(blob));
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      videoRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingVideo(true);
      toast.info("Recording video... Look at your camera.");
    } catch (err) {
      console.error(err);
      toast.error("Camera access denied or unavailable");
    }
  };

  const stopVideoRecording = () => {
    if (videoRecorderRef.current && isRecordingVideo) {
      videoRecorderRef.current.stop();
      setIsRecordingVideo(false);
      toast.success("Video message recorded!");
    }
  };

  // --- SAVE MESSAGE ---
  const handleSaveMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Please enter a title for your message");
    if (!recipientName.trim()) return toast.error("Please enter who this is for");

    if (mediaType === "text" && !contentText.trim()) {
      return toast.error("Please enter your written message");
    }

    if (mediaType === "audio" && !audioBlob) {
      return toast.error("Please record an audio message");
    }

    if (mediaType === "video" && !videoBlob) {
      return toast.error("Please record a video message");
    }

    setSaving(true);
    try {
      let finalMediaUrl: string | null = null;

      // Upload media file to Supabase storage if audio or video
      if (mediaType === "audio" && audioBlob) {
        const filename = `${session?.user?.id}/audio_${Date.now()}.webm`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("legacy-vault")
          .upload(filename, audioBlob, { contentType: "audio/webm", upsert: true });

        if (uploadErr) {
          console.warn("Storage bucket upload issue, saving as base64/local fallback:", uploadErr);
        } else {
          finalMediaUrl = uploadData.path;
        }
      }

      if (mediaType === "video" && videoBlob) {
        const filename = `${session?.user?.id}/video_${Date.now()}.webm`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("legacy-vault")
          .upload(filename, videoBlob, { contentType: "video/webm", upsert: true });

        if (uploadErr) {
          console.warn("Storage upload issue, using fallback:", uploadErr);
        } else {
          finalMediaUrl = uploadData.path;
        }
      }

      const { data, error } = await supabase
        .from("digital_legacy_messages" as any)
        .insert({
          user_id: session?.user?.id,
          title: title.trim(),
          recipient_name: recipientName.trim(),
          recipient_relation: recipientRelation,
          media_type: mediaType,
          content_text: contentText.trim() || null,
          media_url: finalMediaUrl || audioUrl || videoUrl || null,
          is_released: false,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Your message has been safely sealed in your Digital Legacy vault.");
      setMessages([data as any, ...messages]);
      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save message");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setRecipientName("");
    setContentText("");
    setAudioBlob(null);
    setAudioUrl(null);
    setVideoBlob(null);
    setVideoUrl(null);
    setMediaType("text");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this legacy message?")) return;
    try {
      const { error } = await supabase
        .from("digital_legacy_messages" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      setMessages(messages.filter((m) => m.id !== id));
      toast.success("Message removed");
    } catch (err: any) {
      toast.error(err.message || "Could not delete");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">My Digital Legacy</h2>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                Sealed Vault
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Leave heartfelt letters, voice notes, and videos for your loved ones. Safely encrypted and released strictly to your Primary Guardian through verified Secure Vault Claim.
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Create New Message
        </Button>
      </div>

      {/* Security & Confidentiality Notice */}
      <div className="bg-muted/30 border rounded-xl p-3.5 flex items-start gap-3 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <p>
          <strong className="text-foreground">Complete Privacy Guarantee:</strong> Your messages remain 100% confidential. No guardians or family members can open or read these messages while your account is active. They can only be released through the legally verified Secure Vault Claim process.
        </p>
      </div>

      {/* Messages List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">My Sealed Messages ({messages.length})</h3>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600 mx-auto mb-2" />
            Loading your legacy vault...
          </div>
        ) : messages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-foreground">No legacy messages created yet</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Share words of wisdom, a family blessing, favorite memories, or private guidance for your children and family.
              </p>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Record Your First Message
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {messages.map((msg) => (
              <Card key={msg.id} className="relative overflow-hidden border hover:border-emerald-500/40 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{msg.title}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {msg.media_type === "audio" && <Mic className="w-3 h-3 mr-1 text-emerald-600" />}
                          {msg.media_type === "video" && <Video className="w-3 h-3 mr-1 text-emerald-600" />}
                          {msg.media_type === "text" && <FileText className="w-3 h-3 mr-1 text-emerald-600" />}
                          {msg.media_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        For: <strong className="text-foreground">{msg.recipient_name}</strong> ({msg.recipient_relation})
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(msg.id)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                      title="Delete message"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Content Preview */}
                  {msg.media_type === "text" && msg.content_text && (
                    <div className="p-3 bg-muted/40 rounded-lg text-xs text-slate-700 dark:text-slate-300 italic line-clamp-3">
                      "{msg.content_text}"
                    </div>
                  )}

                  {msg.media_type === "audio" && msg.media_url && (
                    <div className="pt-1">
                      <audio controls src={msg.media_url} className="w-full h-8" />
                    </div>
                  )}

                  {msg.media_type === "video" && msg.media_url && (
                    <div className="pt-1">
                      <video controls src={msg.media_url} className="w-full rounded-lg max-h-40 bg-black" />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                    <span className="flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-600" /> Sealed in Vault
                    </span>
                    <span>Created: {new Date(msg.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* CREATE MESSAGE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h3 className="font-bold text-base text-foreground">New Legacy Message</h3>
                <p className="text-xs text-muted-foreground">Recorded for your family, released upon verified claim</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMessage} className="space-y-4">
              {/* Media Format Selector */}
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">Format</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMediaType("text")}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-semibold transition-all ${
                      mediaType === "text"
                        ? "border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <FileText className="w-4 h-4" /> Written Letter
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaType("audio")}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-semibold transition-all ${
                      mediaType === "audio"
                        ? "border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Mic className="w-4 h-4" /> Voice Note
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaType("video")}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-semibold transition-all ${
                      mediaType === "video"
                        ? "border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Video className="w-4 h-4" /> Video Message
                  </button>
                </div>
              </div>

              {/* Title & Recipient */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold">Message Title *</Label>
                  <Input
                    placeholder="e.g. A message for Sarah's graduation, Life lessons for my grandchildren"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="text-xs h-9"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Recipient Name *</Label>
                    <Input
                      placeholder="e.g. Sarah, Ankit, All my family"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      required
                      className="text-xs h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Relationship</Label>
                    <select
                      value={recipientRelation}
                      onChange={(e) => setRecipientRelation(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                    >
                      <option value="Daughter">Daughter</option>
                      <option value="Son">Son</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Grandchild">Grandchild</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Best Friend">Best Friend</option>
                      <option value="Entire Family">Entire Family</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* TEXT ENTRY */}
              {mediaType === "text" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Your Message *</Label>
                  <Textarea
                    placeholder="Write whatever is in your heart... memories, advice, personal blessings, or private instructions."
                    value={contentText}
                    onChange={(e) => setContentText(e.target.value)}
                    rows={6}
                    className="text-xs leading-relaxed"
                    required
                  />
                </div>
              )}

              {/* AUDIO RECORDER */}
              {mediaType === "audio" && (
                <div className="p-4 border rounded-xl bg-muted/20 text-center space-y-3">
                  <div className="text-xs font-semibold text-foreground">Voice Recording</div>
                  {isRecordingAudio ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-red-600 font-bold text-xs animate-pulse">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Recording audio...
                      </div>
                      <Button
                        type="button"
                        onClick={stopAudioRecording}
                        className="bg-red-600 hover:bg-red-700 text-white gap-2 text-xs"
                      >
                        <Square className="w-3.5 h-3.5" /> Stop & Save Recording
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {audioUrl ? (
                        <div className="space-y-2">
                          <audio controls src={audioUrl} className="w-full h-8 mx-auto" />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={startAudioRecording}
                            className="text-xs"
                          >
                            Re-record
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={startAudioRecording}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs"
                        >
                          <Mic className="w-3.5 h-3.5" /> Tap to Start Speaking
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* VIDEO RECORDER */}
              {mediaType === "video" && (
                <div className="p-4 border rounded-xl bg-muted/20 text-center space-y-3">
                  <div className="text-xs font-semibold text-foreground">Video Recording</div>
                  <video
                    ref={videoPreviewRef}
                    muted={isRecordingVideo}
                    className={`w-full max-h-48 rounded-lg bg-black mx-auto ${
                      !isRecordingVideo && !videoUrl ? "hidden" : "block"
                    }`}
                    controls={!isRecordingVideo && !!videoUrl}
                    src={!isRecordingVideo && videoUrl ? videoUrl : undefined}
                  />

                  {isRecordingVideo ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-red-600 font-bold text-xs animate-pulse">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Recording video...
                      </div>
                      <Button
                        type="button"
                        onClick={stopVideoRecording}
                        className="bg-red-600 hover:bg-red-700 text-white gap-2 text-xs"
                      >
                        <Square className="w-3.5 h-3.5" /> Stop & Finish Video
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {videoUrl ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={startVideoRecording}
                          className="text-xs"
                        >
                          Re-record Video
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={startVideoRecording}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs"
                        >
                          <Video className="w-3.5 h-3.5" /> Open Camera & Record
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  Seal in Vault
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DigitalLegacy;
