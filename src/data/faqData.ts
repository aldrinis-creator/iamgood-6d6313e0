// Re-exports from the shared FAQ module so both the app UI and the
// help-assistant edge function read the same source of truth.
// Edit the actual content in supabase/functions/_shared/faq-user.ts.
export type { FaqItem, FaqSection } from "../../supabase/functions/_shared/faq-user";
export { FAQ_VERSION, faqSections } from "../../supabase/functions/_shared/faq-user";
