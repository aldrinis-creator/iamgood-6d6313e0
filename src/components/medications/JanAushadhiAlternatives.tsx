import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Tag, MapPin, ShoppingCart, X, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface JanAushadhiMatch {
  generic_name: string;
  unit_size: string;
  mrp: number;
  salt_composition: string;
  category: string;
}

interface CartItem {
  medName: string;
  genericName: string;
  unitSize: string;
  mrp: number;
}

interface Props {
  medicationNames: string[];
  onFindKendra: () => void;
  onOrderFromKendra: (medName: string, genericName: string) => void;
}

const JanAushadhiAlternatives = ({ medicationNames, onFindKendra, onOrderFromKendra }: Props) => {
  const [matches, setMatches] = useState<Record<string, JanAushadhiMatch[]>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  const search = useCallback(async () => {
    if (!medicationNames.length || searched) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("jan-aushadhi-search", {
        body: { type: "product_search", medications: medicationNames },
      });
      if (!error && data?.results) {
        setMatches(data.results);
      }
    } catch (e) {
      console.error("Jan Aushadhi search error:", e);
    }
    setLoading(false);
    setSearched(true);
  }, [medicationNames, searched]);

  useEffect(() => { search(); }, [search]);

  const addToCart = (medName: string, alt: JanAushadhiMatch) => {
    const exists = cart.some(c => c.genericName === alt.generic_name && c.medName === medName);
    if (exists) return;
    setCart(prev => [...prev, {
      medName,
      genericName: alt.generic_name,
      unitSize: alt.unit_size,
      mrp: alt.mrp,
    }]);
  };

  const removeFromCart = (genericName: string) => {
    setCart(prev => prev.filter(c => c.genericName !== genericName));
  };

  const confirmCart = () => {
    cart.forEach(item => {
      onOrderFromKendra(item.medName, item.genericName);
    });
    setCart([]);
  };

  const isInCart = (medName: string, genericName: string) =>
    cart.some(c => c.genericName === genericName && c.medName === medName);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-3">
        <Loader2 className="w-3 h-3 animate-spin" /> Finding Jan Aushadhi alternatives...
      </div>
    );
  }

  const matchEntries = Object.entries(matches).filter(([, v]) => v.length > 0);
  if (!matchEntries.length) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Tag className="w-4 h-4 text-[hsl(142,70%,45%)]" />
        Jan Aushadhi Alternatives
        <Badge variant="secondary" className="text-[10px] bg-[hsl(142,70%,45%)]/10 text-[hsl(142,70%,45%)]">
          Save 50-90%
        </Badge>
      </h3>
      <p className="text-xs text-muted-foreground">
        Government-approved generics at fraction of branded price.
      </p>

      {matchEntries.map(([medName, alts]) => (
        <Card key={medName} className="border-[hsl(142,70%,45%)]/30 bg-[hsl(142,70%,45%)]/5">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">For: {medName}</p>
            {alts.slice(0, 2).map((alt, i) => {
              const inCart = isInCart(medName, alt.generic_name);
              return (
                <div key={i} className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">💊 {alt.generic_name}</p>
                    <p className="text-xs text-muted-foreground">{alt.unit_size} • {alt.salt_composition}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="text-[10px] bg-[hsl(142,70%,45%)] text-white">
                        MRP ₹{alt.mrp}
                      </Badge>
                    </div>
                  </div>
                  {inCart ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs border-destructive text-destructive"
                      onClick={() => removeFromCart(alt.generic_name)}
                    >
                      <X className="w-3 h-3 mr-1" /> Remove
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs border-[hsl(142,70%,45%)] text-[hsl(142,70%,45%)]"
                      onClick={() => addToCart(medName, alt)}
                    >
                      <ShoppingCart className="w-3 h-3 mr-1" /> Order
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Cart summary */}
      {cart.length > 0 && (
        <Card className="border-[hsl(142,70%,45%)]/50 bg-[hsl(142,70%,45%)]/10">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold text-[hsl(142,70%,45%)] uppercase tracking-wide flex items-center gap-1">
              <ShoppingCart className="w-3 h-3" /> Jan Aushadhi Cart ({cart.length} items)
            </p>
            {cart.map((item) => (
              <div key={item.genericName} className="flex items-center justify-between text-sm">
                <span className="flex-1 truncate text-xs">{item.genericName} — ₹{item.mrp}</span>
                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => removeFromCart(item.genericName)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button
              className="w-full bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,40%)] text-white"
              size="sm"
              onClick={confirmCart}
            >
              <CheckCircle className="w-4 h-4 mr-2" /> Add {cart.length} to Order
            </Button>
          </CardContent>
        </Card>
      )}

      <Button
        variant="outline"
        className="w-full text-[hsl(142,70%,45%)] border-[hsl(142,70%,45%)]/50"
        onClick={onFindKendra}
      >
        <MapPin className="w-4 h-4 mr-2" /> Find Nearest Jan Aushadhi Kendra
      </Button>
    </div>
  );
};

export default JanAushadhiAlternatives;
