Navigation Hierarchy and Consolidation:
The application uses a single primary navigation point: the bottom 'NavTabs' bar. The 'AppHeader' at the top is simplified to avoid redundancy, containing only the logo, user greeting, and utility buttons (Notifications, Accessibility menu, and Profile dropdown). This consolidation ensures a cleaner mobile-first interface by removing duplicate role-based navigation tabs from the top header. Bottom 'NavTabs' include icons, labels, and active-state highlighting with integrated badge indicators for unread notifications and alerts.

My Health tile structure (8 top-level tiles in 3-col grid):
Row 1: Tablets · Health Tools · Ambulance
Row 2: Quick Visual Checks · Wellness Hub · Vitals
Row 3: Vault · Emergency First Aid

Hub tiles (open sub-page with card list, mirror "Health Tools" pattern):
- "Quick Visual Checks" → Urine Analysis, Tongue Analysis, Face Scan Analysis
- "Wellness Hub" → Activity, Wellness, Nutrition
- "Health Tools" → Doctor Visit Report, Medical Documents, Document Analyzer, Symptom Checker, Medication Info, Tele-Consult, Emergency First Aid, Pill Identifier

Legacy ?tool= deep-links (Activity, Wellness, Nutrition, Face Scan, Urine Check, Tongue Check) are auto-redirected to their parent hub via `legacyToolRedirect` in MyHealth.tsx. Add new visual/lifestyle tools to the appropriate hub instead of the top-level grid.
