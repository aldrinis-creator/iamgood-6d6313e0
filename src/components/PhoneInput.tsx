import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const COUNTRY_CODES = [
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+971", label: "🇦🇪 +971" },
  { code: "+65", label: "🇸🇬 +65" },
  { code: "+61", label: "🇦🇺 +61" },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const parsePhone = (value: string): { code: string; number: string } => {
  if (!value) return { code: "+91", number: "" };
  for (const { code } of COUNTRY_CODES) {
    if (value.startsWith(code)) {
      return { code, number: value.slice(code.length).trim() };
    }
  }
  // If no code found, check if starts with +
  const match = value.match(/^(\+\d{1,4})\s*(.*)/);
  if (match) return { code: match[1], number: match[2] };
  return { code: "+91", number: value };
};

const PhoneInput = ({ value, onChange, placeholder = "98765 43210", className }: PhoneInputProps) => {
  const { code, number } = parsePhone(value);

  const handleCodeChange = (newCode: string) => {
    onChange(`${newCode} ${number}`.trim());
  };

  const handleNumberChange = (num: string) => {
    const cleaned = num.replace(/[^\d\s]/g, "");
    onChange(`${code} ${cleaned}`.trim());
  };

  return (
    <div className={`flex gap-2 ${className || ""}`}>
      <Select value={code} onValueChange={handleCodeChange}>
        <SelectTrigger className="w-[100px] shrink-0 text-base">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_CODES.map((c) => (
            <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
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
