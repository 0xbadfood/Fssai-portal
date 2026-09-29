# MyFoodLicense — mobile app (Flutter)

The customer app, a sibling of the web portal. It uses the same API (`/api` on the portal server), and the server
works everything out; the app only renders, as the web does. **Customers only:** team accounts (ops, admin, expert)
are refused by the server when they sign in from the app. A staff app, if ever built, would be separate and for
experts only.

## Run / build

```bash
cd mobile
flutter pub get
flutter analyze
# API_BASE defaults to https://mfl.toystech.in (deploy). Until deploy has the server changes below, use the local instance:
flutter build apk --debug --dart-define=API_BASE=https://fssai.photovault.live
# -> build/app/outputs/flutter-apk/app-debug.apk
```

Emulator (headless, Android 35 image `mfl`, installed 2026-09-29). KVM needs `sudo setfacl -m u:nitin:rw /dev/kvm`
after every reboot:

```bash
~/android-sdk/emulator/emulator -avd mfl -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -no-snapshot &
adb install -r build/app/outputs/flutter-apk/app-debug.apk
adb shell am start -n com.myfoodlicense.app/com.myfoodlicense.myfoodlicense.MainActivity
adb exec-out screencap -p > shot.png     # drive with: adb shell input tap X Y / swipe / text
```

## How it talks to the server

- Every request sends `x-mfl-client: app`. Sign-in (`/api/auth/login|signup|reset`) then also returns `token`,
  which the app keeps in secure storage and sends as `Authorization: Bearer …`. Browsers keep the HttpOnly cookie.
- `GET /api/app/config` (public) gives document types (labels, the AI's check questions) and support topics, so
  they aren't copied into the app.
- Team accounts from the app: login → 403 (checked after the password); a team session sent from the app → 403.
- All of this is in `server/apiPlugin.js` and `server/authService.js` (`login(…, { customersOnly })`).

## Layout

- `lib/core/`: `api.dart` (client), `session.dart`, `store.dart` (application + documents, same logic as the web's
  `useApplication`: requests one at a time, details autosaved as a draft), `doc_prep.dart` (photos → JPEG ≤1600 px;
  PDFs rendered with pdfrx, first 4 pages + text layer, the password is only used on the phone),
  `payments.dart` (Cashfree native SDK → `/payment-result` asks `/api/payments/confirm`), `landing.dart`.
- `lib/widgets/`: `ui.dart` (cards, buttons, bubbles…), `intake.dart` (the question panel, shared by the welcome
  chat and My Application), `doc_card.dart` (pick/upload/AI-check card, file viewer).
- `lib/screens/`: welcome + auth, a five-tab shell (Home, Apply, Vault, Experts, More), the 7 application steps
  (`apply/`), payments, support, premises, expert-services catalogue and orders (`services/`).
- Theme: `lib/theme.dart` uses the web's Tailwind colours; Inter is bundled in `assets/fonts`; the icon is in `assets/icon`.

Gotcha: widgets that read `store` in `build` must not be `const` (a const widget isn't rebuilt when the store
changes). That was the "document disappears after the AI check" bug.

## Status (2026-09-29)

Done and tested on the emulator against the local instance:
- welcome screen and licence check;
- sign-up (the welcome chat's answers carry into the new application);
- My Application's photos step, a photo upload through the AI check, the result staying on the card;
- the fixes from the user's phone: sheet overflow, "Apply" tab label, text scale capped at 1.2.

Not done yet, in order:
1. Walk the rest on the emulator: intake → summary → details → documents (including a **PDF** and a
   **password-protected PDF**) → form → ready; the Home, Vault, Premises, Support, Experts and catalogue screens;
   service order + messages.
2. **Commit** the portal server changes and `mobile/` (nothing from this work is committed yet), then **deploy**
   the server changes (usual bundle/rsync route, restart `myfoodlicense.service`), and rebuild the APK against
   `mfl.toystech.in`.
3. On deploy (Cashfree sandbox), test a real gateway payment in the app: government fee and a service order.
   Cashfree production will need the Android package `com.myfoodlicense.app` whitelisted in its dashboard.
4. Password reset from the app sends the email; the link opens the website (no in-app deep link yet).
5. Release build: signing key, `flutter build appbundle`, store listing. iOS project is set up (camera/photo
   permissions, UPI app queries) but has never been built (needs a Mac).
