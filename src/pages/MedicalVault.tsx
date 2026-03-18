import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, FileText, Shield, Heart, User } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const MedicalVault = () => {
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [showPan, setShowPan] = useState(false);

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <Tabs defaultValue="profile">
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1 text-xs">My Profile</TabsTrigger>
            <TabsTrigger value="guardian" className="flex-1 text-xs">Guardian</TabsTrigger>
            <TabsTrigger value="vault" className="flex-1 text-xs">Secret Vault</TabsTrigger>
            <TabsTrigger value="help" className="flex-1 text-xs">Help</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 mt-4">
            {/* Health Information */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="w-5 h-5 text-sos" />
                  Health Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Blood Group</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Food Preference</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select preference" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="veg">Vegetarian</SelectItem>
                      <SelectItem value="nonveg">Non-Vegetarian</SelectItem>
                      <SelectItem value="vegan">Vegan</SelectItem>
                      <SelectItem value="eggetarian">Eggetarian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Allergies</Label>
                  <Input placeholder="e.g., Penicillin, Peanuts" className="text-base" />
                </div>
                <div>
                  <Label>Medical Conditions</Label>
                  <Input placeholder="e.g., Diabetes, Hypertension" className="text-base" />
                </div>
              </CardContent>
            </Card>

            {/* Family Doctor */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Family Doctor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Doctor's Name</Label>
                  <Input placeholder="Dr. " className="text-base" />
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <div className="flex gap-2">
                    <Select defaultValue="+91">
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="+91">+91</SelectItem>
                        <SelectItem value="+1">+1</SelectItem>
                        <SelectItem value="+44">+44</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Phone number" className="flex-1 text-base" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Insurance */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-success" />
                  Insurance Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Health Insurance Provider</Label>
                  <Input placeholder="e.g., Star Health" className="text-base" />
                </div>
                <div>
                  <Label>Policy Number</Label>
                  <Input placeholder="Policy number" className="text-base" />
                </div>
                <div>
                  <Label>Life Insurance Provider</Label>
                  <Input placeholder="e.g., LIC" className="text-base" />
                </div>
                <div>
                  <Label>Policy Number</Label>
                  <Input placeholder="Policy number" className="text-base" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guardian" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">My Guardians</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: "Priya Sharma", relation: "Daughter", phone: "+91 98765 43210", primary: true },
                  { name: "Rahul Sharma", relation: "Son", phone: "+91 98765 43211", primary: false },
                ].map((g) => (
                  <div key={g.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-sm">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{g.relation} • {g.phone}</p>
                    </div>
                    {g.primary && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">Primary</span>
                    )}
                  </div>
                ))}
                <Button variant="outline" className="w-full">+ Add Guardian</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vault" className="space-y-4 mt-4">
            {/* Government IDs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Government ID Cards
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Aadhaar Number</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type={showAadhaar ? "text" : "password"}
                      defaultValue="1234 5678 9012"
                      className="flex-1 text-base"
                    />
                    <button onClick={() => setShowAadhaar(!showAadhaar)} className="p-2">
                      {showAadhaar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label>PAN Number</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type={showPan ? "text" : "password"}
                      defaultValue="ABCDE1234F"
                      className="flex-1 text-base"
                    />
                    <button onClick={() => setShowPan(!showPan)} className="p-2">
                      {showPan ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Emergency PDF */}
            <Button className="w-full bg-primary" size="lg">
              <FileText className="w-4 h-4 mr-2" />
              Generate Emergency PDF
            </Button>
            <Button variant="outline" className="w-full" size="lg">
              Share with Responder
            </Button>
          </TabsContent>

          <TabsContent value="help" className="space-y-4 mt-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-lg font-semibold">Need Help?</h3>
                <p className="text-sm text-muted-foreground">
                  Check-iN is designed to keep you safe. If you have questions or need assistance, reach out to our support team.
                </p>
                <Button variant="outline" className="w-full">📧 Email Support</Button>
                <Button variant="outline" className="w-full">📞 Call Helpline</Button>
                <Button variant="outline" className="w-full">📖 User Guide</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default MedicalVault;
