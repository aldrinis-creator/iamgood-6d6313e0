

## Plan — Draft WhatsApp Template for MSG91 Approval

You'll copy the content below into MSG91 dashboard → WhatsApp Templates → Create New, submit for approval, then paste the approved template ID back to me.

---

### Template Metadata

| Field | Value |
|---|---|
| **Template Name** | `pharmacy_order` |
| **Category** | `UTILITY` (transactional — faster approval than MARKETING) |
| **Language** | `English` (`en`) |
| **Header** | None (text-only template — fastest approval) |
| **Footer** | `Sent via Check-iN` |
| **Buttons** | None |

---

### Template Body (paste exactly)

```
Hello, new medication order received via Check-iN.

*Patient:* {{1}}
*Doctor:* {{2}}
*Clinic/Hospital:* {{3}}
*Order Date:* {{4}}

*Items:*
{{5}}

Please confirm availability and delivery time. Reply to this message to coordinate.
```

### Sample Values (MSG91 requires these for approval)

| Variable | Sample |
|---|---|
| `{{1}}` Patient name | `Ramesh Kumar` |
| `{{2}}` Doctor name | `Dr. A. Sharma` |
| `{{3}}` Clinic / Hospital | `Apollo Clinic, Indiranagar` |
| `{{4}}` Order date | `21 Apr 2026` |
| `{{5}}` Items list | `1. Metformin 500mg — Qty: 30\n2. Atorvastatin 10mg — Qty: 30\n3. Telmisartan 40mg — Qty: 30` |

---

### Why these choices

- **UTILITY category**: Order placement is transactional, not promotional — Meta approves these in 1–24h vs days for MARKETING.
- **No header/buttons**: Each interactive element adds approval risk and rejection reasons. Plain body = highest approval rate.
- **Asterisks for bold**: WhatsApp renders `*text*` as **bold** — keeps the message scannable for busy pharmacists.
- **Single items variable `{{5}}`**: Avoids needing a fixed item count. We'll join all order lines with `\n` server-side before sending.
- **Footer "Sent via Check-iN"**: Brand attribution + signals legitimate business sender.

---

### Your steps

1. Log in to **MSG91 dashboard → WhatsApp → Templates → Add New**.
2. Paste the body, name (`pharmacy_order`), category (UTILITY), language (English).
3. Fill the 5 sample values from the table above.
4. Submit for approval.
5. Once approved (status = "Approved"), copy the **Template ID** (looks like a long alphanumeric string) and share it with me.

### After you share the template ID

I'll proceed with the build:
1. Request the `MSG91_PHARMACY_TEMPLATE_ID` secret and ask you to paste the ID.
2. Create `supabase/functions/send-pharmacy-order/index.ts` that calls MSG91 Flow API with the 5 variables.
3. Update `RefillOrder.tsx` (User) and `WardRefillOrder.tsx` (Guardian) to invoke the function, with `wa.me` fallback on failure.
4. Register the function in `supabase/config.toml` with `verify_jwt = true`.

### Common rejection reasons to avoid

- Don't add promotional language ("Best prices!", "Discount") — that flips it to MARKETING and gets rejected as UTILITY.
- Don't use `{{1}}` at the very start of the body — Meta rejects templates that open with a variable.
- Don't include URLs in the body unless absolutely needed — increases scrutiny.

The template above already follows all three rules.

