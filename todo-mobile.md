# Mobile app to-dos

Changes made on the web portal that the Flutter app (`mobile/`) hasn't caught up with yet.

- **Sign-up no longer asks for a business name (portal, 2026-10-04).** An owner can have several outlets under different names, so the business is named on each application (`info.legal_name`, first field of the details step) instead of the account. The server now treats `businessName` at sign-up as optional; the app still asks for it and sends it, which keeps working (it becomes the pre-fill for the first application).
  - Remove the "Business name" field from the sign-up screen (`lib/screens/auth/auth_screens.dart`).
  - The account sheet (`lib/screens/shell.dart`) already shows `businessName` only when present; consider showing the current application's business name instead.
