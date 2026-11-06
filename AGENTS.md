# Architecture rules

- Keep Edge Function authentication in the shared request guard; scheduled global work requires internal credentials or a server-verified administrator.
- Grant privileged roles only through protected server administration, never signup metadata or profile contact matches.
- Generate pharmacy messages from a persisted order authorized to the caller; browser WhatsApp fallback remains available.
- Clean user-supplied report fragments with DOMPurify and escape plain report fields; keep share URLs out of inline JavaScript.