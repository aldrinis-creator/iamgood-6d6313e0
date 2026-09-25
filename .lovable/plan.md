# Vitals storage: payment page note + phone pop-up warnings

## 1. The ₹99 payment page (futurewave.in/pay)
futurewave.in/pay is a separate website. It isn't part of this app, so it can't be built from here. The app already sends people there with everything the page needs:
- plan = vitals-storage, billing = monthly, amount = 9900 (₹99), user_id, and a return link.

Whoever runs futurewave.in needs to add a ₹99 monthly "vitals-storage" option. After payment, the page should call back the same way it does for Basic/Pro. The app already accepts "vitals-storage" when a payment is confirmed, so nothing else changes on the app side.

Until that option exists, the app will show a friendly message on the Extra Storage card instead of opening a page that goes nowhere: "Extra Storage checkout is coming soon — contact support to add it."

## 2. Phone pop-up warnings: recommended
Right now, people only see the warnings if they open the app. Deleting data is permanent, so a phone pop-up is worth adding.
- At each of the 3 warnings (last day of the month, the 5th, and 11:00 AM on the 7th), send a phone pop-up to the ward.
- Send the same pop-up to the ward's accepted guardians, worded for them: "[Ward name]'s vitals older than a month will be deleted on [date]."
- Guardians also get the warning in their in-app Alerts list.
- Tapping the pop-up opens the Subscription page (ward) or the ward's vitals (guardian).
- Each person gets each warning only once. Anyone with Extra Storage gets no warnings.

## Technical details
- vitals-retention: after inserting into vitals_retention_notices, also send web-push through the existing push sender to the ward's push_subscriptions, and to accepted guardians' (guardian_user_id). For guardians, insert a notification with guardian_id and type "vitals_retention".
- sw.ts: handle the "vitals_retention" type and set the click URL (/subscription or /guardian).
- Subscription.tsx: add a flag VITALS_STORAGE_CHECKOUT_LIVE (false for now). While it's false, show the "coming soon" message; flip it to true once futurewave.in is ready.
