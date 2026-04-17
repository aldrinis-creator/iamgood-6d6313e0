import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";

export interface NutritionTrendPoint {
  label: string;
  protein: number;
  sodium: number;
  potassium: number;
  fiber: number;
}

interface SeriesConfig {
  key: keyof Omit<NutritionTrendPoint, "label">;
  label: string;
  unit: "g" | "mg";
  color: string;
}

const SERIES: SeriesConfig[] = [
  { key: "protein", label: "Protein", unit: "g", color: "hsl(var(--primary))" },
  { key: "fiber", label: "Fiber", unit: "g", color: "hsl(var(--success))" },
  { key: "sodium", label: "Sodium", unit: "mg", color: "hsl(0 84% 60%)" },
  { key: "potassium", label: "Potassium", unit: "mg", color: "hsl(45 93% 47%)" },
];

interface NutritionTrendChartProps {
  data: NutritionTrendPoint[];
  height?: number;
}

const NutritionTrendChart = ({ data, height = 200 }: NutritionTrendChartProps) => {
  const [active, setActive] = useState<Record<string, boolean>>({
    protein: true,
    fiber: true,
    sodium: false,
    potassium: false,
  });

  const toggle = (key: string) => setActive((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {SERIES.map((s) => (
          <Badge
            key={s.key}
            variant={active[s.key] ? "default" : "outline"}
            className="cursor-pointer text-xs"
            style={active[s.key] ? { backgroundColor: s.color, borderColor: s.color } : { color: s.color, borderColor: s.color }}
            onClick={() => toggle(s.key)}
          >
            {s.label} ({s.unit})
          </Badge>
        ))}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              formatter={(val: number, name: string) => {
                const s = SERIES.find((x) => x.label === name);
                return [`${Math.round(val)} ${s?.unit ?? ""}`, name];
              }}
            />
            {SERIES.filter((s) => active[s.key]).map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default NutritionTrendChart;
