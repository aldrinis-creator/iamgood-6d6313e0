import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trash2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Guardian {
  id: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string | null;
  relation: string | null;
  is_primary: boolean;
}

interface GuardianTabProps {
  userId: string | undefined;
}

const GuardianTab = ({ userId }: GuardianTabProps) => {
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState("");

  const fetchGuardians = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("guardians")
      .select("id, guardian_name, guardian_phone, guardian_email, relation, is_primary")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false });

    if (error) {
      console.error("Error fetching guardians:", error);
    } else {
      setGuardians(data || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchGuardians();
  }, [fetchGuardians]);

  const handleAdd = async () => {
    if (!userId || !name.trim() || !phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("guardians").insert({
      user_id: userId,
      guardian_name: name.trim(),
      guardian_phone: phone.trim(),
      guardian_email: email.trim() || null,
      relation: relation.trim() || null,
      is_primary: guardians.length === 0,
    });

    if (error) {
      toast.error("Failed to add guardian");
      console.error(error);
    } else {
      toast.success("Guardian added");
      setName("");
      setPhone("");
      setEmail("");
      setRelation("");
      setShowForm(false);
      fetchGuardians();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("guardians").delete().eq("id", id);
    if (error) {
      toast.error("Failed to remove guardian");
    } else {
      toast.success("Guardian removed");
      fetchGuardians();
    }
  };

  return (
    <TabsContent value="guardian" className="space-y-4 mt-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">My Guardians</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : guardians.length > 0 ? (
            guardians.map((g) => (
              <div key={g.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">{g.guardian_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.relation && `${g.relation} • `}{g.guardian_phone}
                  </p>
                  {g.guardian_email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" />
                      {g.guardian_email}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {g.is_primary && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">Primary</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(g.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              No guardians added yet
            </p>
          )}

          {showForm ? (
            <div className="space-y-3 p-3 rounded-lg border border-border">
              <div>
                <Label className="text-xs">Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Guardian name" />
              </div>
              <div>
                <Label className="text-xs">Phone *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div>
                <Label className="text-xs">Email (for notifications)</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="guardian@email.com" type="email" />
              </div>
              <div>
                <Label className="text-xs">Relation</Label>
                <Input value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="e.g. Daughter, Son" />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAdd} disabled={adding} className="flex-1">
                  {adding && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                  Add
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
              + Add Guardian
            </Button>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
};

export default GuardianTab;
