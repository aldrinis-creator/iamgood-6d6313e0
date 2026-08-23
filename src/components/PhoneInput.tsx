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

const PhoneInput = ({ value, onChange, placeholder = "xxxxx xxxxx", className }: PhoneInputProps) => {
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
      <div className="relative flex-1">
        <Input
          value={number}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder={placeholder}
          className="w-full text-base pr-10"
          inputMode="tel"
        />
        {'contacts' in navigator && 'ContactsManager' in window && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={async () => {
              try {
                const props = ['tel'];
                const opts = { multiple: false };
                const contacts = await (navigator as any).contacts.select(props, opts);
                if (contacts && contacts.length > 0 && contacts[0].tel && contacts[0].tel.length > 0) {
                  let selectedPhone = contacts[0].tel[0];
                  // If it has a country code, re-parse the entire string
                  if (selectedPhone.startsWith('+')) {
                    onChange(selectedPhone);
                  } else {
                    handleNumberChange(selectedPhone);
                  }
                }
              } catch (ex) {
                console.error("Contact picker failed:", ex);
              }
            }}
            title="Choose from Contacts"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </Button>
        )}
      </div>
    </div>
  );
};

export default PhoneInput;
