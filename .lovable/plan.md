

## Auth Email Templates — Already Set Up

Your auth email templates are already configured and branded with the Check-iN identity:

- **6 templates exist**: Signup confirmation, Magic link, Password recovery, Invite, Email change, and Reauthentication
- **Branding applied**: Navy blue (#1a365d) primary color, circular "C-iN" logo badge, 12px rounded buttons, and the standard "Check-iN — Personal Emergency Response System / Future Wave Technologies Pvt. Ltd." footer
- **Queue-based sending**: The auth email hook already uses the durable email queue with retry safety

### What needs to happen

The only remaining step is **DNS verification**. Your domain `notify.www.futurewave.in` is currently verifying (nameservers: `ns5.lovable.cloud`, `ns6.lovable.cloud`). Once DNS propagates (up to 72 hours), auth emails will automatically start sending from your branded domain.

### Action required at your DNS provider

Make sure these NS records exist for `notify.www.futurewave.in` at your domain registrar:
- `notify.www.futurewave.in` → NS → `ns5.lovable.cloud`
- `notify.www.futurewave.in` → NS → `ns6.lovable.cloud`

### No code changes needed

Everything is already in place. If you want to modify the styling or wording of any specific template (e.g., change button text, update copy), I can do that — just let me know which template to update.

