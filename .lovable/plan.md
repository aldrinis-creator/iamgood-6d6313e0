

## Reorder Dashboard & Make Health Passport Collapsible

### Current order
1. Mode Selector
2. Map My Journey card
3. Check-In Card
4. Health Passport
5. How It Works accordion
6. AI Health Companion

### New order
1. Mode Selector
2. Check-In Card
3. Map My Journey card ← moved below Check-In
4. Health Passport (inside an Accordion, collapsed by default) ← made collapsible
5. How It Works accordion
6. AI Health Companion

### Changes in `src/pages/UserDashboard.tsx`

Rearrange the JSX blocks (lines 237–254):

```tsx
{/* Check-In Card */}
<CheckInCard />

{/* Map My Journey */}
<Card className="cursor-pointer hover:shadow-md ..." onClick={() => navigate("/journey")}>
  ...
</Card>

{/* Health Passport — collapsible */}
<Accordion type="single" collapsible>
  <AccordionItem value="health-passport">
    <AccordionTrigger className="text-accessible font-semibold">
      Health Passport
    </AccordionTrigger>
    <AccordionContent>
      <HealthPassport />
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

Single file change, pure reorder + wrap in existing `Accordion` component.

