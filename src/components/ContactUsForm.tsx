import { useEffect, useState } from "react";
import { z } from "zod";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PhoneInput from "@/components/PhoneInput";

const SUBJECTS = [
  "General Inquiry",
  "Bug Report",
  "Feature Request",
  "Billing",
  "Other",
];

const contactSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  subject: z.string().refine((v) => SUBJECTS.includes(v), "Select a subject"),
  message: z.string().trim().min(1, "Message is required").max(1000, "Message must be under 1000 characters"),
});

const ContactUsForm = () => {
  const { session, profile } = useAuth();
  const userId = session?.user?.id ?? null;
  const userEmail = session?.user?.email ?? "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("General Inquiry");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    if (userEmail) setEmail(userEmail);
    if (profile?.phone) setPhone(profile.phone);
  }, [profile, userEmail]);

  const handleSubmit = async () => {
    const parsed = contactSchema.safeParse({
      full_name: fullName,
      email,
      phone,
      subject,
      message,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("contact_submissions").insert({
      user_id: userId,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      subject: parsed.data.subject,
      message: parsed.data.message,
      source: "app-profile",
    });
    setSubmitting(false);

    if (error) {
      toast.error("Failed to send message. Please try again.");
      console.error(error);
      return;
    }

    toast.success("Message sent! We'll get back to you soon.");
    setMessage("");
    setSubject("General Inquiry");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" /> Contact Us
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Have a question, found a bug, or want to suggest a feature? Send us a message.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Full Name *</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            maxLength={100}
            className="text-base"
          />
        </div>
        <div>
          <Label className="text-xs">Email *</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            maxLength={255}
            className="text-base"
          />
        </div>
        <div>
          <Label className="text-xs">Phone (optional)</Label>
          <PhoneInput value={phone} onChange={setPhone} />
        </div>
        <div>
          <Label className="text-xs">Subject *</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Message * <span className="text-muted-foreground">({message.length}/1000)</span></Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="How can we help?"
            rows={5}
            maxLength={1000}
            className="text-base"
          />
        </div>
        <Button onClick={handleSubmit} disabled={submitting} className="w-full">
          {submitting ? (
            <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Sending…</>
          ) : (
            <><Send className="w-4 h-4 mr-1" /> Send Message</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ContactUsForm;
