# Mobile app to-dos

Changes made on the web portal that the Flutter app (`mobile/`) hasn't caught up with yet.

- **Sign-up no longer asks for a business name (portal, 2026-10-04).** An owner can have several outlets under different names, so the business is named on each application (`info.legal_name`, first field of the details step) instead of the account. The server now treats `businessName` at sign-up as optional; the app still asks for it and sends it, which keeps working (it becomes the pre-fill for the first application).
  - Remove the "Business name" field from the sign-up screen (`lib/screens/auth/auth_screens.dart`).
  - The account sheet (`lib/screens/shell.dart`) already shows `businessName` only when present; consider showing the current application's business name instead.
- **Sign-up and reset checks (portal, 2026-10-04).** The server now enforces the shared rules in `src/lib/accountRules.js`: password of 8+ characters with a letter and a number, not common and not built from the name/email/phone; a 10-digit Indian mobile (6–9 first; +91/0 and spaces accepted, stored as 10 digits); a well-formed email whose domain accepts mail. The app already shows the server's error message, so it works, but it should match the web form:
  - a "Confirm password" field, a show/hide toggle and the live rules checklist with the strength bar (`src/components/auth/PasswordFields.jsx`);
  - the mobile field with a +91 prefix and digits only, errors after leaving a field, and the "Did you mean …@gmail.com?" hint for email typos.
