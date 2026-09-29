import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/session.dart';
import '../core/store.dart';
import '../theme.dart';
import '../widgets/logo.dart';
import '../widgets/ui.dart';

/// Launch screen while the saved session is checked.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(
        body: DecoratedBox(
          decoration: BoxDecoration(gradient: G.page),
          child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Logo(tagline: true, size: 1.2), SizedBox(height: 28), Spinner()])),
        ),
      );
}

/// Where the customer lands after signing in: the dashboard once the application is complete, otherwise the application.
class StartScreen extends StatefulWidget {
  const StartScreen({super.key});
  @override
  State<StartScreen> createState() => _StartScreenState();
}

class _StartScreenState extends State<StartScreen> {
  @override
  void initState() {
    super.initState();
    store.loadCurrent().then((_) {
      if (mounted) context.go(store.ready ? '/home' : '/apply');
    });
  }

  @override
  Widget build(BuildContext context) => const SplashScreen();
}

/// The customer app: logo and account on top, five tabs below (the web's sidebar).
class CustomerShell extends StatelessWidget {
  const CustomerShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  static const tabs = [
    (LucideIcons.house, 'Home'),
    (LucideIcons.sparkles, 'Apply'),
    (LucideIcons.folderOpen, 'Vault'),
    (LucideIcons.userCheck, 'Experts'),
    (LucideIcons.layoutGrid, 'More'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAF9FF),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFAF9FF),
        titleSpacing: 16,
        title: const Logo(),
        actions: const [AccountButton(), SizedBox(width: 12)],
      ),
      body: shell,
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(border: Border(top: BorderSide(color: C.slate100))),
        child: NavigationBar(
          selectedIndex: shell.currentIndex,
          onDestinationSelected: (i) {
            if (shell.currentIndex == 1) store.flushDraft();
            shell.goBranch(i, initialLocation: i == shell.currentIndex);
          },
          destinations: [for (final (icon, label) in tabs) NavigationDestination(icon: Icon(icon), label: label)],
        ),
      ),
    );
  }
}

/// Avatar with initials; opens the account sheet (email, log out).
class AccountButton extends StatelessWidget {
  const AccountButton({super.key});
  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(99),
      onTap: () => showAccountSheet(context),
      child: Container(
        width: 38,
        height: 38,
        alignment: Alignment.center,
        decoration: const BoxDecoration(shape: BoxShape.circle, gradient: G.violet),
        child: Text(session.initials, style: t(13, w: w7, c: Colors.white)),
      ),
    );
  }
}

void showAccountSheet(BuildContext context) {
  final u = session.user ?? {};
  showModalBottomSheet(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    builder: (c) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 52,
              height: 52,
              alignment: Alignment.center,
              decoration: const BoxDecoration(shape: BoxShape.circle, gradient: G.violet),
              child: Text(session.initials, style: t(18, w: w8, c: Colors.white)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(session.name, style: t(18, w: w8, c: C.slate900)),
                if (u['businessName'] != null) Text(u['businessName'], style: t(14, c: C.slate500)),
              ]),
            ),
          ]),
          const SizedBox(height: 16),
          AppCard(
            padding: const EdgeInsets.all(14),
            child: Column(children: [
              _row(LucideIcons.mail, u['email'] ?? ''),
              const SizedBox(height: 8),
              _row(LucideIcons.phone, u['phone'] ?? ''),
            ]),
          ),
          const SizedBox(height: 16),
          BigButton(
            label: 'Log out',
            icon: LucideIcons.logOut,
            tone: Tone.white,
            onPressed: () {
              Navigator.pop(c);
              store.flushDraft();
              session.logout();
            },
          ),
        ]),
      ),
    ),
  );
}

Widget _row(IconData icon, String text) => Row(children: [Icon(icon, size: 16, color: C.slate400), const SizedBox(width: 10), Expanded(child: Text(text, style: t(15, w: w6, c: C.slate800)))]);
