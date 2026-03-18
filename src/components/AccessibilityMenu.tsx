import { useState, useCallback, useEffect } from "react";
import { X, Type, AlignLeft, MousePointer2, ImageOff, Heading, Search, FileText, Maximize2, Moon, Contrast, Eye, EyeOff, Palette, Accessibility, RotateCcw, Minus, Plus, Keyboard, Highlighter, PanelTop, ScanLine, Pause, LayoutList, Zap, Brain, Activity, Focus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface A11yState {
  fontSize: number; // 0-100 slider
  biggerText: boolean;
  lineHeight: boolean;
  letterSpacing: boolean;
  pageRead: boolean;
  biggerCursor: boolean;
  hideImages: boolean;
  textAlignment: boolean;
  highlightHeadings: boolean;
  textMagnifier: boolean;
  imageDescription: boolean;
  enlargeButtons: boolean;
  // Colors
  darkMode: boolean;
  invertColor: boolean;
  lowSaturation: boolean;
  highSaturation: boolean;
  grayscale: boolean;
  darkHighContrast: boolean;
  whiteHighContrast: boolean;
  // Color Adjustment
  textColor: string | null;
  bgColor: string | null;
  // Profiles
  activeProfile: string | null;
  // Navigation
  readingLine: boolean;
  highlightLinks: boolean;
  readingMask: boolean;
  readingMaskLine: boolean;
  pauseAnimation: boolean;
  pageStructure: boolean;
  virtualKeyboard: boolean;
}

const defaultState: A11yState = {
  fontSize: 50,
  biggerText: false,
  lineHeight: false,
  letterSpacing: false,
  pageRead: false,
  biggerCursor: false,
  hideImages: false,
  textAlignment: false,
  highlightHeadings: false,
  textMagnifier: false,
  imageDescription: false,
  enlargeButtons: false,
  darkMode: false,
  invertColor: false,
  lowSaturation: false,
  highSaturation: false,
  grayscale: false,
  darkHighContrast: false,
  whiteHighContrast: false,
  textColor: null,
  bgColor: null,
  activeProfile: null,
  readingLine: false,
  highlightLinks: false,
  readingMask: false,
  readingMaskLine: false,
  pauseAnimation: false,
  pageStructure: false,
  virtualKeyboard: false,
};

const colorSwatches = [
  { value: "#1e40af", label: "Blue" },
  { value: "#6d28d9", label: "Purple" },
  { value: "#dc2626", label: "Red" },
  { value: "#ea580c", label: "Orange" },
  { value: "#0d9488", label: "Teal" },
  { value: "#16a34a", label: "Green" },
  { value: "#f5f5f5", label: "Light" },
  { value: "#171717", label: "Dark" },
];

const ToggleButton = ({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center",
      active
        ? "bg-primary/10 border-primary text-primary"
        : "bg-card border-border text-muted-foreground hover:border-primary/30"
    )}
  >
    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", active ? "bg-primary/20" : "bg-muted")}>
      <Icon className="w-5 h-5" />
    </div>
    <span className="text-xs font-medium leading-tight">{label}</span>
  </button>
);

const AccessibilityMenu = () => {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<A11yState>(() => {
    try {
      const saved = localStorage.getItem("a11y-settings");
      return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState;
    } catch {
      return defaultState;
    }
  });

  const update = useCallback((partial: Partial<A11yState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem("a11y-settings", JSON.stringify(next));
      return next;
    });
  }, []);

  const toggle = useCallback((key: keyof A11yState) => {
    setState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("a11y-settings", JSON.stringify(next));
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setState(defaultState);
    localStorage.removeItem("a11y-settings");
  }, []);

  // Apply accessibility effects to the document
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // Font size
    const scale = 0.8 + (state.fontSize / 100) * 0.8; // 0.8x to 1.6x
    root.style.fontSize = state.biggerText ? `${scale * 100}%` : "";

    // Line height
    body.style.lineHeight = state.lineHeight ? "2" : "";

    // Letter spacing
    body.style.letterSpacing = state.letterSpacing ? "0.12em" : "";

    // Cursor
    body.style.cursor = state.biggerCursor ? "url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"32\" height=\"32\" viewBox=\"0 0 24 24\" fill=\"black\"><path d=\"M5 3l14 9-7 2-4 7z\"/></svg>') 0 0, auto" : "";

    // Images
    if (state.hideImages) {
      body.classList.add("a11y-hide-images");
    } else {
      body.classList.remove("a11y-hide-images");
    }

    // Grayscale / Saturation / Invert / Contrast
    const filters: string[] = [];
    if (state.grayscale) filters.push("grayscale(1)");
    if (state.lowSaturation) filters.push("saturate(0.3)");
    if (state.highSaturation) filters.push("saturate(2)");
    if (state.invertColor) filters.push("invert(1)");
    root.style.filter = filters.join(" ");

    // Dark mode override
    if (state.darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Highlight headings
    if (state.highlightHeadings) {
      body.classList.add("a11y-highlight-headings");
    } else {
      body.classList.remove("a11y-highlight-headings");
    }

    // Highlight links
    if (state.highlightLinks) {
      body.classList.add("a11y-highlight-links");
    } else {
      body.classList.remove("a11y-highlight-links");
    }

    // Pause animations
    if (state.pauseAnimation) {
      body.classList.add("a11y-pause-animations");
    } else {
      body.classList.remove("a11y-pause-animations");
    }

    // Text/bg color overrides
    if (state.textColor) {
      body.style.setProperty("--a11y-text-color", state.textColor);
      body.classList.add("a11y-text-color");
    } else {
      body.classList.remove("a11y-text-color");
      body.style.removeProperty("--a11y-text-color");
    }
    if (state.bgColor) {
      body.style.setProperty("--a11y-bg-color", state.bgColor);
      body.classList.add("a11y-bg-color");
    } else {
      body.classList.remove("a11y-bg-color");
      body.style.removeProperty("--a11y-bg-color");
    }

    return () => {
      root.style.fontSize = "";
      root.style.filter = "";
      body.style.lineHeight = "";
      body.style.letterSpacing = "";
      body.style.cursor = "";
      body.classList.remove("a11y-hide-images", "a11y-highlight-headings", "a11y-highlight-links", "a11y-pause-animations", "a11y-text-color", "a11y-bg-color");
      body.style.removeProperty("--a11y-text-color");
      body.style.removeProperty("--a11y-bg-color");
    };
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="p-2 rounded-full hover:bg-primary-foreground/10" aria-label="Accessibility Menu">
          <Accessibility className="w-5 h-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[340px] sm:w-[380px] overflow-y-auto p-0">
        <SheetHeader className="bg-primary text-primary-foreground p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-primary-foreground text-lg">Accessibility Menu</SheetTitle>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-primary-foreground/20">
              <X className="w-5 h-5" />
            </button>
          </div>
        </SheetHeader>

        <div className="p-4">
          <Accordion type="multiple" defaultValue={["content"]} className="w-full space-y-2">
            {/* ===== CONTENT ===== */}
            <AccordionItem value="content" className="border-none">
              <AccordionTrigger className="text-base font-semibold hover:no-underline py-2">Content</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="grid grid-cols-3 gap-2">
                  <ToggleButton active={state.biggerText} onClick={() => toggle("biggerText")} icon={Type} label="Bigger Text" />
                  <ToggleButton active={state.lineHeight} onClick={() => toggle("lineHeight")} icon={AlignLeft} label="Line Height" />
                  <ToggleButton active={state.letterSpacing} onClick={() => toggle("letterSpacing")} icon={Type} label="Letter Spacing" />
                </div>

                {/* Font size slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Aa</span>
                    <span className="text-lg text-muted-foreground">Aa</span>
                  </div>
                  <Slider
                    value={[state.fontSize]}
                    onValueChange={([v]) => update({ fontSize: v, biggerText: true })}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <button onClick={() => update({ fontSize: 50, biggerText: false })} className="text-xs text-muted-foreground hover:text-foreground">
                    RESET
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <ToggleButton active={state.pageRead} onClick={() => toggle("pageRead")} icon={FileText} label="Page Read" />
                  <ToggleButton active={state.biggerCursor} onClick={() => toggle("biggerCursor")} icon={MousePointer2} label="Bigger Cursor" />
                  <ToggleButton active={state.hideImages} onClick={() => toggle("hideImages")} icon={ImageOff} label="Hide Images" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ToggleButton active={state.textAlignment} onClick={() => toggle("textAlignment")} icon={AlignLeft} label="Text Alignment" />
                  <ToggleButton active={state.highlightHeadings} onClick={() => toggle("highlightHeadings")} icon={Heading} label="Highlight Headings" />
                  <ToggleButton active={state.textMagnifier} onClick={() => toggle("textMagnifier")} icon={Search} label="Text Magnifiers" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ToggleButton active={state.imageDescription} onClick={() => toggle("imageDescription")} icon={FileText} label="Image Description" />
                  <ToggleButton active={state.enlargeButtons} onClick={() => toggle("enlargeButtons")} icon={Maximize2} label="Enlarge Buttons" />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ===== COLORS ===== */}
            <AccordionItem value="colors" className="border-none">
              <AccordionTrigger className="text-base font-semibold hover:no-underline py-2">Colors</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="grid grid-cols-3 gap-2">
                  <ToggleButton active={state.darkMode} onClick={() => toggle("darkMode")} icon={Moon} label="Dark Mode" />
                  <ToggleButton active={state.invertColor} onClick={() => toggle("invertColor")} icon={Contrast} label="Invert Color" />
                  <ToggleButton active={state.lowSaturation} onClick={() => toggle("lowSaturation")} icon={Eye} label="Low Saturation" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ToggleButton active={state.highSaturation} onClick={() => toggle("highSaturation")} icon={Eye} label="High Saturation" />
                  <ToggleButton active={state.grayscale} onClick={() => toggle("grayscale")} icon={EyeOff} label="Grayscale" />
                  <ToggleButton active={state.darkHighContrast} onClick={() => toggle("darkHighContrast")} icon={Contrast} label="Dark High Contrast" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ToggleButton active={state.whiteHighContrast} onClick={() => toggle("whiteHighContrast")} icon={Contrast} label="White High Contrast" />
                </div>
                <button onClick={() => update({ darkMode: false, invertColor: false, lowSaturation: false, highSaturation: false, grayscale: false, darkHighContrast: false, whiteHighContrast: false })} className="text-xs text-muted-foreground hover:text-foreground">
                  RESET
                </button>
              </AccordionContent>
            </AccordionItem>

            {/* ===== PROFILES ===== */}
            <AccordionItem value="profiles" className="border-none">
              <AccordionTrigger className="text-base font-semibold hover:no-underline py-2">Profiles</AccordionTrigger>
              <AccordionContent className="space-y-2 pt-2">
                {[
                  { id: "blindness", icon: Activity, title: "Blindness Profile", desc: "Making the website accessible with Screen Readers" },
                  { id: "visually-impaired", icon: Eye, title: "Visually Impaired Profile", desc: "Designed for Better Visibility and Usability" },
                  { id: "cognitive", icon: Brain, title: "Cognitive and Learning Profile", desc: "Enhancing Focused User Experiences" },
                  { id: "epilepsy", icon: Zap, title: "Epilepsy Profile", desc: "Creating Comfortable and Seizure-Safe Web Experiences" },
                  { id: "adhd", icon: Focus, title: "ADHD Profile", desc: "Building Websites That Support Attention and Ease of Use" },
                ].map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => update({ activeProfile: state.activeProfile === profile.id ? null : profile.id })}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                      state.activeProfile === profile.id
                        ? "bg-primary/10 border-primary"
                        : "bg-card border-border hover:border-primary/30"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", state.activeProfile === profile.id ? "bg-primary/20" : "bg-muted")}>
                      <profile.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{profile.title}</p>
                      <p className="text-xs text-primary">{profile.desc}</p>
                    </div>
                  </button>
                ))}
              </AccordionContent>
            </AccordionItem>

            {/* ===== COLOR ADJUSTMENT ===== */}
            <AccordionItem value="color-adjustment" className="border-none">
              <AccordionTrigger className="text-base font-semibold hover:no-underline py-2">Color Adjustment</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="p-3 rounded-xl border border-border space-y-2">
                  <p className="text-sm font-medium">Adjust Text Color</p>
                  <div className="flex gap-2 flex-wrap">
                    {colorSwatches.map((c) => (
                      <button
                        key={`text-${c.value}`}
                        onClick={() => update({ textColor: state.textColor === c.value ? null : c.value })}
                        className={cn("w-8 h-8 rounded-full border-2 transition-all", state.textColor === c.value ? "border-primary scale-110" : "border-transparent")}
                        style={{ backgroundColor: c.value }}
                        aria-label={`Text color: ${c.label}`}
                      />
                    ))}
                  </div>
                  <button onClick={() => update({ textColor: null })} className="text-xs text-muted-foreground hover:text-foreground">RESET</button>
                </div>
                <div className="p-3 rounded-xl border border-border space-y-2">
                  <p className="text-sm font-medium">Adjust Background Color</p>
                  <div className="flex gap-2 flex-wrap">
                    {colorSwatches.map((c) => (
                      <button
                        key={`bg-${c.value}`}
                        onClick={() => update({ bgColor: state.bgColor === c.value ? null : c.value })}
                        className={cn("w-8 h-8 rounded-full border-2 transition-all", state.bgColor === c.value ? "border-primary scale-110" : "border-transparent")}
                        style={{ backgroundColor: c.value }}
                        aria-label={`Background color: ${c.label}`}
                      />
                    ))}
                  </div>
                  <button onClick={() => update({ bgColor: null })} className="text-xs text-muted-foreground hover:text-foreground">RESET</button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ===== NAVIGATION ===== */}
            <AccordionItem value="navigation" className="border-none">
              <AccordionTrigger className="text-base font-semibold hover:no-underline py-2">Navigation</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="grid grid-cols-3 gap-2">
                  <ToggleButton active={state.readingLine} onClick={() => toggle("readingLine")} icon={AlignLeft} label="Reading Line" />
                  <ToggleButton active={state.highlightLinks} onClick={() => toggle("highlightLinks")} icon={Highlighter} label="Highlight Links" />
                  <ToggleButton active={state.readingMask} onClick={() => toggle("readingMask")} icon={PanelTop} label="Reading Mask" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ToggleButton active={state.readingMaskLine} onClick={() => toggle("readingMaskLine")} icon={ScanLine} label="Reading Mask & Line" />
                  <ToggleButton active={state.pauseAnimation} onClick={() => toggle("pauseAnimation")} icon={Pause} label="Pause Animation" />
                  <ToggleButton active={state.pageStructure} onClick={() => toggle("pageStructure")} icon={LayoutList} label="Page Structure" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ToggleButton active={state.virtualKeyboard} onClick={() => toggle("virtualKeyboard")} icon={Keyboard} label="Virtual Keyboard" />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Global Reset */}
          <div className="pt-4 pb-2">
            <Button variant="outline" className="w-full gap-2" onClick={resetAll}>
              <RotateCcw className="w-4 h-4" />
              Reset All Settings
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AccessibilityMenu;
