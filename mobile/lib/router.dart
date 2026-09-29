import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'core/session.dart';
import 'core/store.dart';
import 'screens/apply/apply_screen.dart';
import 'screens/auth/auth_screens.dart';
import 'screens/auth/welcome_screen.dart';
import 'screens/home_screen.dart';
import 'screens/more_screens.dart';
import 'screens/payments_screen.dart';
import 'screens/services/catalogue_screens.dart';
import 'screens/services/orders_screens.dart';
import 'screens/shell.dart';
import 'screens/support_screen.dart';
import 'screens/vault_screen.dart';

/// Where to go after signing in (e.g. back to the service being bought), set by the sign-in screens.
String? returnTo;

const _signIn = ['/welcome', '/login', '/signup', '/forgot'];

final _rootKey = GlobalKey<NavigatorState>();

final router = GoRouter(
  navigatorKey: _rootKey,
  initialLocation: '/',
  refreshListenable: session,
  redirect: (context, state) {
    final loc = state.matchedLocation;
    if (!session.ready) return loc == '/' ? null : '/';
    final public = _signIn.contains(loc) || loc.startsWith('/catalogue');
    if (!session.signedIn) {
      store.reset();
      return public ? null : '/welcome';
    }
    if (loc == '/' || _signIn.contains(loc)) {
      final back = returnTo;
      returnTo = null;
      return back ?? '/start';
    }
    return null;
  },
  routes: [
    GoRoute(path: '/', builder: (_, _) => const SplashScreen()),
    GoRoute(path: '/welcome', builder: (_, _) => const WelcomeScreen()),
    GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
    GoRoute(path: '/signup', builder: (_, _) => const SignupScreen()),
    GoRoute(path: '/forgot', builder: (_, s) => ForgotScreen(email: s.uri.queryParameters['email'])),
    GoRoute(path: '/catalogue', builder: (_, s) => CatalogueScreen(head: s.uri.queryParameters['head'])),
    GoRoute(path: '/catalogue/:id', builder: (_, s) => ServiceDetailScreen(id: s.pathParameters['id']!)),
    GoRoute(path: '/start', builder: (_, _) => const StartScreen()),

    // The customer's app: five tabs, each keeping its own place.
    StatefulShellRoute.indexedStack(
      builder: (_, _, shell) => CustomerShell(shell: shell),
      branches: [
        StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, _) => const HomeScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: '/apply', builder: (_, _) => const ApplyScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: '/vault', builder: (_, _) => const VaultScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: '/experts', builder: (_, _) => const MyServicesScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: '/more', builder: (_, _) => const MoreScreen())]),
      ],
    ),
    GoRoute(parentNavigatorKey: _rootKey, path: '/premises', builder: (_, _) => const PremisesScreen()),
    GoRoute(parentNavigatorKey: _rootKey, path: '/payments', builder: (_, _) => const PaymentsScreen()),
    GoRoute(parentNavigatorKey: _rootKey, path: '/support', builder: (_, s) => SupportScreen(topic: s.uri.queryParameters['topic'])),
    GoRoute(parentNavigatorKey: _rootKey, path: '/orders/:id/pay', builder: (_, s) => ServiceCheckoutScreen(id: s.pathParameters['id']!)),
    GoRoute(parentNavigatorKey: _rootKey, path: '/payment-result', builder: (_, s) => PaymentResultScreen(order: s.uri.queryParameters['order'] ?? '')),

  ],
);
