import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api.dart';
import '../../core/config.dart';
import '../../core/session.dart';
import '../../theme.dart';
import '../../widgets/logo.dart';
import '../../widgets/ui.dart';

/// Sign-in pages: logo, a white card, the disclaimer (as the web's AuthShell).
class AuthShell extends StatelessWidget {
  const AuthShell({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(backgroundColor: const Color(0xFFF7F5FF)),
      backgroundColor: Colors.white,
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFF7F5FF), Colors.white])),
        child: SafeArea(
          top: false,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            children: [
              const Center(child: Logo(tagline: true)),
              const SizedBox(height: 22),
              AppCard(padding: const EdgeInsets.all(22), child: AutofillGroup(child: child)),
              const SizedBox(height: 18),
              const Disclaimer(),
            ],
          ),
        ),
      ),
    );
  }
}

class Disclaimer extends StatelessWidget {
  const Disclaimer({super.key});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: C.slate50, borderRadius: BorderRadius.circular(16), border: Border.all(color: C.slate100)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(LucideIcons.info, size: 15, color: C.slate400),
          const SizedBox(width: 8),
          Expanded(child: Text(trustDisclaimer, style: t(11.5, c: C.slate500, h: 1.45))),
        ]),
      );
}

Widget _title(IconData icon, String text) => Row(children: [
      Icon(icon, size: 20, color: C.violet700),
      const SizedBox(width: 8),
      Expanded(child: Text(text, style: t(21, w: w8, c: C.slate900))),
    ]);

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  String error = '';
  bool busy = false;

  Future<void> submit() async {
    if (email.text.trim().isEmpty || password.text.isEmpty) return setState(() => error = 'Enter your email and password.');
    setState(() {
      error = '';
      busy = true;
    });
    try {
      await session.login(email.text, password.text);
      TextInput.finishAutofillContext();
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _title(LucideIcons.logIn, 'Sign in to your account'),
        const SizedBox(height: 18),
        if (error.isNotEmpty) ...[Notice(error), const SizedBox(height: 14)],
        LabeledField(label: 'Email address', controller: email, hint: 'you@business.com', keyboard: TextInputType.emailAddress, autofill: const [AutofillHints.email], action: TextInputAction.next),
        const SizedBox(height: 14),
        LabeledField(label: 'Password', controller: password, hint: '••••••••', obscure: true, autofill: const [AutofillHints.password], action: TextInputAction.done, onSubmitted: (_) => submit()),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(onPressed: () => context.push('/forgot?email=${Uri.encodeComponent(email.text.trim())}'), child: Text('Forgot password?', style: t(13.5, w: w7, c: C.violet600))),
        ),
        BigButton(label: busy ? 'Signing in…' : 'Sign in', busy: busy, onPressed: submit),
        const SizedBox(height: 18),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Text("Don't have an account? ", style: t(14, c: C.slate500)),
          GestureDetector(onTap: () => context.pushReplacement('/signup'), child: Text('Start free', style: t(14, w: w7, c: C.violet600))),
        ]),
      ]),
    );
  }
}

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});
  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final f = {for (final k in ['businessName', 'name', 'email', 'phone', 'password']) k: TextEditingController()};
  String error = '';
  bool busy = false;

  Future<void> submit() async {
    setState(() {
      error = '';
      busy = true;
    });
    try {
      await session.signup({for (final e in f.entries) e.key: e.value.text.trim()});
      TextInput.finishAutofillContext();
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const next = TextInputAction.next;
    return AuthShell(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _title(LucideIcons.userPlus, 'Create your account'),
        const SizedBox(height: 6),
        Text('Free to start. Find your licence, upload documents and get your forms filled.', style: t(14, c: C.slate500, h: 1.4)),
        const SizedBox(height: 18),
        if (error.isNotEmpty) ...[Notice(error), const SizedBox(height: 14)],
        ...spaced([
          LabeledField(label: 'Business name', controller: f['businessName']!, hint: 'Acme Foods Pvt. Ltd.', autofill: const [AutofillHints.organizationName], action: next),
          LabeledField(label: 'Your name', controller: f['name']!, hint: 'Rahul Kumar', autofill: const [AutofillHints.name], action: next),
          LabeledField(label: 'Email address', controller: f['email']!, hint: 'you@business.com', keyboard: TextInputType.emailAddress, autofill: const [AutofillHints.email], action: next),
          LabeledField(label: 'Mobile number', controller: f['phone']!, hint: '98765 43210', keyboard: TextInputType.phone, autofill: const [AutofillHints.telephoneNumber], action: next),
          LabeledField(label: 'Password', controller: f['password']!, hint: 'At least 8 characters', obscure: true, autofill: const [AutofillHints.newPassword], action: TextInputAction.done, onSubmitted: (_) => submit()),
        ], 14),
        const SizedBox(height: 20),
        BigButton(label: busy ? 'Creating account…' : 'Create account & continue', busy: busy, onPressed: submit),
        const SizedBox(height: 18),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Text('Already have an account? ', style: t(14, c: C.slate500)),
          GestureDetector(onTap: () => context.pushReplacement('/login'), child: Text('Sign in', style: t(14, w: w7, c: C.violet600))),
        ]),
      ]),
    );
  }
}

class ForgotScreen extends StatefulWidget {
  const ForgotScreen({super.key, this.email});
  final String? email;
  @override
  State<ForgotScreen> createState() => _ForgotScreenState();
}

class _ForgotScreenState extends State<ForgotScreen> {
  late final email = TextEditingController(text: widget.email);
  bool busy = false, sent = false;
  String error = '';

  Future<void> submit() async {
    setState(() {
      busy = true;
      error = '';
    });
    try {
      await api.post('/api/auth/forgot', {'email': email.text.trim()});
      setState(() => sent = true);
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      child: sent
          ? Column(children: [
              const Icon(LucideIcons.mailCheck, size: 44, color: C.violet600),
              const SizedBox(height: 12),
              Text('Check your email', style: t(21, w: w8, c: C.slate900)),
              const SizedBox(height: 8),
              Text(
                "If ${email.text.trim()} has an account, we've sent a link to choose a new password. It expires in 30 minutes. "
                'Open it on this phone, set the new password, then sign in here.',
                textAlign: TextAlign.center,
                style: t(14.5, c: C.slate600, h: 1.45),
              ),
              const SizedBox(height: 18),
              BigButton(label: 'Back to sign in', tone: Tone.white, onPressed: () => context.pop()),
            ])
          : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              _title(LucideIcons.keyRound, 'Forgot your password?'),
              const SizedBox(height: 6),
              Text("Enter the email you signed up with and we'll send you a link to choose a new one.", style: t(14, c: C.slate500, h: 1.4)),
              const SizedBox(height: 18),
              if (error.isNotEmpty) ...[Notice(error), const SizedBox(height: 14)],
              LabeledField(label: 'Email address', controller: email, hint: 'you@business.com', keyboard: TextInputType.emailAddress, autofill: const [AutofillHints.email], onSubmitted: (_) => submit()),
              const SizedBox(height: 18),
              BigButton(label: busy ? 'Sending…' : 'Send reset link', busy: busy, onPressed: submit),
            ]),
    );
  }
}
