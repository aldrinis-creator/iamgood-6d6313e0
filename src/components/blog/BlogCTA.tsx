import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart } from "lucide-react";

export const BlogCTA = () => (
  <Card className="mt-10 border-primary/30 bg-primary/5">
    <CardContent className="p-6 text-center space-y-3">
      <Heart className="w-10 h-10 mx-auto text-primary" aria-hidden />
      <h2 className="text-xl font-bold text-primary">Try Check-iN free</h2>
      <p className="text-base text-muted-foreground">
        Daily check-ins, medication reminders, SOS, and a shared emergency profile —
        built for Indian families caring for elderly parents.
      </p>
      <Button asChild size="lg" className="mt-2">
        <Link to="/register">Get Check-iN free</Link>
      </Button>
    </CardContent>
  </Card>
);

export default BlogCTA;
