import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { COUNTRIES, DEFAULT_DIAL, findCountryByPhone, type Country } from "@/lib/countryCodes";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const parsePhone = (value: string): { country: Country | undefined; dial: string; number: string } => {
  if (!value) return { country: COUNTRIES.find((c) => c.dial === DEFAULT_DIAL), dial: DEFAULT_DIAL, number: "" };
  const country = findCountryByPhone(value);
  const cleaned = value.replace(/[()\-]/g, "");
  if (country) {
    return { country, dial: country.dial, number: cleaned.slice(country.dial.length).trim() };
  }
  const match = cleaned.match(/^(\+\d{1,4})\s*(.*)$/);
  if (match) return { country: undefined, dial: match[1], number: match[2] };
  return { country: COUNTRIES.find((c) => c.dial === DEFAULT_DIAL), dial: DEFAULT_DIAL, number: cleaned };
};

const PhoneInput = ({ value, onChange, placeholder = "98765 43210", className }: PhoneInputProps) => {
  const [open, setOpen] = useState(false);
  const { country, dial, number } = useMemo(() => parsePhone(value), [value]);

  const handleCodeChange = (newDial: string) => {
    onChange(`${newDial} ${number}`.trim());
    setOpen(false);
  };

  const handleNumberChange = (num: string) => {
    const cleaned = num.replace(/[^\d\s]/g, "");
    onChange(`${dial} ${cleaned}`.trim());
  };

  return (
    <div className={`flex gap-2 ${className || ""}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select country code"
            className="w-[110px] shrink-0 justify-between px-2 text-base font-normal"
          >
            <span className="truncate">{country ? `${country.flag} ${country.dial}` : dial}</span>
            <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0 z-50 bg-popover" align="start">
          <Command
            filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
          >
            <CommandInput placeholder="Search country or code..." />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((c) => (
                  <CommandItem
                    key={`${c.iso}-${c.dial}`}
                    value={`${c.name} ${c.dial} ${c.iso}`}
                    onSelect={() => handleCodeChange(c.dial)}
                  >
                    <Check className={`mr-2 h-4 w-4 ${country?.iso === c.iso ? "opacity-100" : "opacity-0"}`} />
                    <span className="mr-2">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-muted-foreground ml-2">{c.dial}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        value={number}
        onChange={(e) => handleNumberChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-base"
        inputMode="tel"
      />
    </div>
  );
};

export default PhoneInput;
