import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Navigation, Battery, Clock, MapPin, Ambulance, AlertTriangle, Wifi } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const GuardianDashboard = () => {
  const [showAmbulanceBooking, setShowAmbulanceBooking] = useState(false);

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        {/* User Status */}
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center text-success-foreground font-bold">
                  A
                </div>
                <div>
                  <p className="font-semibold">Arjun</p>
                  <p className="text-xs text-success font-medium">● Online — Safe</p>
                </div>
              </div>
              <span className="text-xs bg-success/20 text-success px-2 py-1 rounded-full">Active</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-card">
                <Battery className="w-4 h-4 mx-auto text-success mb-1" />
                <p className="text-sm font-semibold">78%</p>
                <p className="text-[10px] text-muted-foreground">Battery</p>
              </div>
              <div className="p-2 rounded-lg bg-card">
                <Clock className="w-4 h-4 mx-auto text-primary mb-1" />
                <p className="text-sm font-semibold">2m ago</p>
                <p className="text-[10px] text-muted-foreground">Last Active</p>
              </div>
              <div className="p-2 rounded-lg bg-card">
                <Wifi className="w-4 h-4 mx-auto text-primary mb-1" />
                <p className="text-sm font-semibold">4G</p>
                <p className="text-[10px] text-muted-foreground">Network</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Map Placeholder */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Live Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23666' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }} />
              <div className="text-center z-10">
                <MapPin className="w-10 h-10 text-sos mx-auto mb-2" />
                <p className="text-sm font-medium">Sector 15, Gurugram</p>
                <p className="text-xs text-muted-foreground">28.4595° N, 77.0266° E</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2">
          <Button className="flex-col h-auto py-4 bg-primary" size="lg">
            <Phone className="w-5 h-5 mb-1" />
            <span className="text-xs">Call User</span>
          </Button>
          <Button className="flex-col h-auto py-4 bg-success hover:bg-success/90" size="lg">
            <Navigation className="w-5 h-5 mb-1" />
            <span className="text-xs">Route</span>
          </Button>
          <Button
            className="flex-col h-auto py-4 bg-sos hover:bg-sos/90"
            size="lg"
            onClick={() => setShowAmbulanceBooking(true)}
          >
            <Ambulance className="w-5 h-5 mb-1" />
            <span className="text-xs">Ambulance</span>
          </Button>
        </div>

        {/* Ambulance Booking */}
        {showAmbulanceBooking && (
          <Card className="border-sos/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-sos" />
                <h3 className="font-semibold">Priority Ambulance Booking</h3>
              </div>
              <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Base fare (first 5 km)</span>
                  <span className="font-semibold">₹1,500</span>
                </div>
                <div className="flex justify-between">
                  <span>Additional (per km)</span>
                  <span className="font-semibold">₹300</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Estimated arrival: 8–12 minutes • Nearest unit: 2.3 km away
              </p>
              <Button className="w-full bg-sos hover:bg-sos/90 text-lg py-6">
                🚑 Confirm Ambulance — ₹1,500
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => setShowAmbulanceBooking(false)}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent Check-Ins */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Today's Check-iNs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { time: "7:00 AM", status: "Checked In", ok: true },
              { time: "12:00 PM", status: "Checked In", ok: true },
              { time: "7:00 PM", status: "Pending", ok: false },
            ].map((ci) => (
              <div key={ci.time} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm">{ci.time}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  ci.ok ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                }`}>
                  {ci.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default GuardianDashboard;
