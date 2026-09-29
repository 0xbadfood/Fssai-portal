import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/landing.dart';
import '../../core/store.dart';
import '../../theme.dart';
import '../../widgets/intake.dart';
import '../../widgets/logo.dart';
import '../../widgets/ui.dart';
import 'auth_screens.dart';

/// Before sign-in: what we do, and the licence check to try right away (the web landing page).
class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});
  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  final scroll = ScrollController();
  final chatKey = GlobalKey();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: const Color(0xFFF7F5FF),
        titleSpacing: 16,
        title: const Logo(),
        actions: [
          TextButton(onPressed: () => context.push('/login'), child: Text('Sign in', style: t(15, w: w7, c: C.violet700))),
          const SizedBox(width: 8),
        ],
      ),
      body: ListView(
        controller: scroll,
        padding: EdgeInsets.zero,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFF7F5FF), Color(0xFFFDF8FF), Colors.white])),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Tag('AI-powered FSSAI compliance', bg: Colors.white, fg: C.violet700, icon: LucideIcons.sparkles, border: C.violet100),
              const SizedBox(height: 16),
              Text.rich(
                TextSpan(children: [
                  const TextSpan(text: 'Your FSSAI licence,\n'),
                  WidgetSpan(
                    child: ShaderMask(
                      shaderCallback: (r) => G.brandBar.createShader(r),
                      child: Text('without the headache.', style: t(34, w: w9, c: Colors.white, h: 1.1, ls: -1)),
                    ),
                  ),
                ]),
                style: t(34, w: w9, c: C.slate900, h: 1.1, ls: -1),
              ),
              const SizedBox(height: 14),
              Text(
                "Snap two photos, tap a few answers, and our AI fills in your forms. Our FSSAI experts check everything before it's filed, and stay with you for anything that comes after.",
                style: t(16, c: C.slate600, h: 1.5),
              ),
              const SizedBox(height: 22),
              BigButton(label: 'Start free', trailingIcon: LucideIcons.arrowRight, onPressed: () => context.push('/signup')),
              const SizedBox(height: 10),
              BigButton(label: 'Talk to an expert', icon: LucideIcons.userCheck, tone: Tone.white, onPressed: () => context.push('/catalogue')),
              const SizedBox(height: 18),
              for (final x in ['Registration, State & Central licences', 'Label & artwork review', 'Help with notices & rejections', 'Compliance & food safety'])
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(children: [const Icon(LucideIcons.circleCheck, size: 16, color: C.emerald500), const SizedBox(width: 8), Text(x, style: t(14, w: w5, c: C.slate600))]),
                ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(children: [
              Text('👇 Try it now: find your licence in about a minute', style: t(14, w: w6, c: C.slate500)),
              const SizedBox(height: 10),
              LandingChat(key: chatKey, scroll: scroll),
            ]),
          ),
          const SizedBox(height: 32),
          const _Pillars(),
          const _HowItWorks(),
          const Padding(padding: EdgeInsets.fromLTRB(16, 8, 16, 32), child: Disclaimer()),
        ],
      ),
    );
  }
}

/// Tap-first licence check. The conversation runs on the server (same graph and rules as the signed-in intake); the
/// session id is kept on the phone and handed to the first application after sign-up.
class LandingChat extends StatefulWidget {
  const LandingChat({super.key, required this.scroll});
  final ScrollController scroll;
  @override
  State<LandingChat> createState() => _LandingChatState();
}

class _LandingChatState extends State<LandingChat> {
  static const greeting = "Namaste! 👋 I'm your FSSAI assistant. Tap a few answers and I'll tell you exactly which licence your food business needs.";
  Json? view; // { session, question, summary, result, transcript, clarify }
  bool thinking = false;
  String? pending;
  String error = '';
  final questionKey = GlobalKey();
  final text = TextEditingController();

  Future<Json> call(String action, [Json body = const {}]) async => asMap(await api.post('/api/intake/$action', body));

  @override
  void initState() {
    super.initState();
    () async {
      final id = await landingSession();
      try {
        Json v;
        if (id != null) {
          try {
            v = await call('resume', {'session': id});
          } catch (_) {
            await saveLandingSession(null);
            v = await call('preview');
          }
        } else {
          v = await call('preview');
        }
        if (mounted) setState(() => view = v);
      } on ApiException catch (e) {
        if (mounted) setState(() => error = e.message);
      }
    }();
  }

  Future<void> send(String action, Json body, [String? shown]) async {
    setState(() {
      thinking = true;
      pending = shown;
      error = '';
    });
    final started = DateTime.now();
    try {
      final next = await call(action, {'session': view?['session'], ...body});
      final wait = 650 - DateTime.now().difference(started).inMilliseconds;
      if (wait > 0) await Future.delayed(Duration(milliseconds: wait));
      if (next['session'] != null) await saveLandingSession(next['session'] as String);
      if (mounted) setState(() => view = next);
    } on ApiException catch (e) {
      if (e.status == 404) {
        await saveLandingSession(null);
        final fresh = await call('preview').catchError((_) => view ?? {});
        if (mounted) {
          setState(() {
            view = fresh;
            error = 'That chat had expired, so we started again.';
          });
        }
      } else if (mounted) {
        setState(() => error = e.message);
      }
    } finally {
      if (mounted) {
        setState(() {
          thinking = false;
          pending = null;
        });
      }
    }
    // A new question scrolls into view (its answers can be taller than the screen).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = questionKey.currentContext;
      if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 400), curve: Curves.easeOut, alignment: 0.1);
    });
  }

  void sendText() {
    final clean = text.text.trim();
    final q = asMap(view?['question']);
    if (clean.isEmpty || q.isEmpty) return;
    text.clear();
    send('answer', {'questionId': q['id'], 'text': clean.length > 1000 ? clean.substring(0, 1000) : clean}, clean);
  }

  @override
  Widget build(BuildContext context) {
    final q = view?['question'] == null ? null : asMap(view!['question']);
    final result = view?['result'] == null ? null : asMap(view!['result']);
    final log = asList(view?['transcript']);
    final clarify = asMap(view?['clarify']);
    final guesses = q != null && clarify['questionId'] == q['id'] ? asStrings(clarify['guesses']) : <String>[];

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: C.violet100),
        boxShadow: [BoxShadow(color: C.violet300.withValues(alpha: 0.35), blurRadius: 40, offset: const Offset(0, 16))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
          decoration: const BoxDecoration(gradient: G.brandBar),
          child: Row(children: [
            Stack(clipBehavior: Clip.none, children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.2), border: Border.all(color: Colors.white.withValues(alpha: 0.4), width: 2)),
                child: const Icon(LucideIcons.sparkles, size: 18, color: Colors.white),
              ),
              Positioned(right: -1, bottom: -1, child: Container(width: 12, height: 12, decoration: BoxDecoration(color: const Color(0xFF34D399), shape: BoxShape.circle, border: Border.all(color: C.fuchsia500, width: 2)))),
            ]),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('FSSAI Assistant', style: t(14, w: w8, c: Colors.white)),
                Text('AI-powered · replies instantly', style: t(12, c: Colors.white.withValues(alpha: 0.8))),
              ]),
            ),
            if (log.isNotEmpty)
              TextButton.icon(
                style: TextButton.styleFrom(backgroundColor: Colors.white.withValues(alpha: 0.15), foregroundColor: Colors.white, shape: const StadiumBorder()),
                onPressed: thinking ? null : () => send('restart', {}),
                icon: const Icon(LucideIcons.rotateCcw, size: 13),
                label: Text('Start over', style: t(12, w: w6, c: Colors.white)),
              ),
          ]),
        ),
        Container(
          padding: const EdgeInsets.fromLTRB(12, 16, 12, 16),
          decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x99F5F3FF), Colors.white])),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: spaced([
              const Bubble(small: true, avatar: 28, child: Text(greeting)),
              for (final m in log) ...[
                UserBubble(m['answer'] ?? '', small: true),
                if (m['reply'] != null) Bubble(small: true, avatar: 28, child: Text(m['reply'])),
              ],
              if (pending != null && pending!.isNotEmpty) UserBubble(pending!, small: true),
              if (error.isNotEmpty) Bubble(small: true, avatar: 28, child: Text(error)),
              if (thinking || view == null)
                const Bubble(small: true, avatar: 28, child: TypingDots())
              else if (q != null)
                Padding(
                  key: questionKey,
                  padding: const EdgeInsets.only(left: 4),
                  child: QuestionPanel(
                    key: ValueKey('${q['id']}|${q['title']}'),
                    q: q,
                    compact: true,
                    busy: thinking,
                    guesses: guesses,
                    onAnswer: (payload, shown) => send('answer', payload, shown),
                  ),
                )
              else if (result != null)
                KeyedSubtree(key: questionKey, child: _Result(result: result, session: view?['session'] as String?)),
            ], 10),
          ),
        ),
        Container(
          padding: const EdgeInsets.all(10),
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: C.slate100))),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: text,
                enabled: q?['typing'] == true && !thinking,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => sendText(),
                style: t(15, c: C.slate800),
                decoration: InputDecoration(
                  isDense: true,
                  fillColor: C.slate50,
                  hintText: q == null
                      ? 'Tap Start over to try again'
                      : q['typing'] == true
                          ? (q['number'] == 1 ? 'Or just tell me, e.g. "I run a cloud kitchen"' : 'Or type your answer')
                          : 'Tap one of the options above',
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: C.slate200)),
                  disabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: C.slate200)),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              style: IconButton.styleFrom(backgroundColor: C.violet600, disabledBackgroundColor: C.violet200, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
              onPressed: q?['typing'] == true && !thinking ? sendText : null,
              icon: const Icon(LucideIcons.send, size: 17, color: Colors.white),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _Result extends StatefulWidget {
  const _Result({required this.result, this.session});
  final Json result;
  final String? session;
  @override
  State<_Result> createState() => _ResultState();
}

class _ResultState extends State<_Result> {
  bool rated = false;

  Widget cta(String label, String to) => Align(
        alignment: Alignment.centerLeft,
        child: BigButton(label: label, trailingIcon: LucideIcons.arrowRight, small: true, expand: false, onPressed: () => context.push(to)),
      );

  @override
  Widget build(BuildContext context) {
    final e = widget.result;
    final reasons = asStrings(e['reasons']);
    if (e['outcome'] == 'notfood') {
      return Bubble(small: true, avatar: 28, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text("You don't need FSSAI approval 👍", style: t(15, w: w8, c: C.sky700)),
        const SizedBox(height: 4),
        Text(e['guidance'] ?? ''),
      ]));
    }
    if (e['outcome'] == 'deemed') {
      return Bubble(small: true, avatar: 28, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text("Good news — you're already covered ✅", style: t(15, w: w8, c: C.emerald700)),
        const SizedBox(height: 4),
        Text('${reasons.isEmpty ? '' : reasons.first} Many vendors still register to display the FSSAI logo — we can do that for you too.'),
        const SizedBox(height: 10),
        cta('Register anyway', '/signup'),
      ]));
    }
    if (e['licence'] == null) {
      final handover = asStrings(e['handover']);
      return Bubble(small: true, avatar: 28, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Our FSSAI expert will place your business 🧑‍⚖️', style: t(15, w: w8, c: C.violet700)),
        const SizedBox(height: 4),
        Text("Your answers don't fit a standard category exactly. ${handover.isEmpty ? '' : handover.first}"),
        const SizedBox(height: 10),
        cta('Talk to an expert', '/catalogue?head=licensing-approvals'),
      ]));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Bubble(small: true, avatar: 28, child: Text("Here's what your business needs:")),
      const SizedBox(height: 10),
      Container(
        margin: const EdgeInsets.only(left: 38),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: C.violet100),
          boxShadow: [BoxShadow(color: C.violet100.withValues(alpha: 0.9), blurRadius: 18, offset: const Offset(0, 8))],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            decoration: const BoxDecoration(gradient: G.violetDeep),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('YOU NEED', style: t(11, w: w7, c: Colors.white.withValues(alpha: 0.8), ls: 0.6)),
              Text(e['licence'], style: t(20, w: w8, c: Colors.white)),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (final r in reasons) Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(r, style: t(13.5, c: C.slate600, h: 1.4))),
              for (final task in asList(e['tasks']))
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text('+ ${task['label']}${task['licence'] != null ? ' (${task['licence']})' : ''}: ${task['text']}', style: t(13.5, w: w6, c: C.slate700, h: 1.4)),
                ),
              Wrap(spacing: 6, runSpacing: 6, children: [
                Tag('Form ${e['form']}', bg: C.violet50, fg: C.violet700),
                Tag(e['fee'] != null && e['fee'] != 0 ? 'Govt fee ${rupees(e['fee'])}/year' : 'No government fee', bg: C.emerald50, fg: C.emerald700),
              ]),
              const SizedBox(height: 12),
              cta('Continue my application', '/signup'),
              const SizedBox(height: 10),
              if (widget.session != null)
                rated
                    ? Text('Thanks for letting us know!', style: t(12.5, w: w6, c: C.slate500))
                    : Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 6, children: [
                        Text('Is this right?', style: t(12.5, c: C.slate500)),
                        for (final (id, emoji) in [('right', '👍'), ('wrong', '👎'), ('unsure', '🤔')])
                          InkWell(
                            borderRadius: BorderRadius.circular(99),
                            onTap: () {
                              setState(() => rated = true);
                              unawaited(api.post('/api/intake/rate', {'session': widget.session, 'rating': id}).catchError((_) => null));
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(borderRadius: BorderRadius.circular(99), border: Border.all(color: C.slate200)),
                              child: Text(emoji),
                            ),
                          ),
                      ]),
              const SizedBox(height: 6),
              Text("Your answers are saved — you won't be asked again.", style: t(11, c: C.slate400)),
            ]),
          ),
        ]),
      ),
    ]);
  }
}

class _Pillars extends StatelessWidget {
  const _Pillars();
  static const items = [
    (LucideIcons.sparkles, [C.violet500, C.fuchsia500], C.violet50, 'AI-ENABLED', 'AI does the paperwork',
        ['Reads your ID and electricity bill from a photo', 'Fills in Form A or B for you', 'Checks every document before it is submitted']),
    (LucideIcons.mousePointerClick, [C.orange400, C.pink500], C.orange50, 'SIMPLER THAN YOU THINK', 'A few taps, no jargon',
        ['Plain questions about your business', 'Tap an answer or just type it in your own words', 'Works on your phone, start to finish']),
    (LucideIcons.userCheck, [C.emerald500, C.teal500], C.emerald50, 'REAL EXPERTS', 'FSSAI specialists behind every step',
        ['Licensing, compliance and food safety', 'Notices, rejections and officer queries handled', 'A person to call when something is unclear']),
  ];
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('WHY US', style: t(12, w: w7, c: C.violet500, ls: 1.2), textAlign: TextAlign.center),
          const SizedBox(height: 6),
          Text('Smart technology. Simple steps. Real experts.', textAlign: TextAlign.center, style: t(24, w: w8, c: C.slate900, h: 1.2, ls: -0.4)),
          const SizedBox(height: 20),
          for (final (icon, grad, tint, kicker, title, points) in items)
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(24)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                IconBadge(icon, size: 52, fg: Colors.white, gradient: G.of(grad[0], grad[1])),
                const SizedBox(height: 16),
                Text(kicker, style: t(11.5, w: w7, c: C.slate500, ls: 0.8)),
                const SizedBox(height: 2),
                Text(title, style: t(21, w: w8, c: C.slate900, h: 1.2)),
                const SizedBox(height: 10),
                for (final p in points)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Padding(padding: EdgeInsets.only(top: 1), child: Icon(LucideIcons.circleCheck, size: 16, color: C.slate400)),
                      const SizedBox(width: 8),
                      Expanded(child: Text(p, style: t(14, c: C.slate600, h: 1.4))),
                    ]),
                  ),
              ]),
            ),
        ]),
      );
}

class _HowItWorks extends StatelessWidget {
  const _HowItWorks();
  static const steps = [
    (LucideIcons.camera, 'Snap two photos', 'Your ID and an electricity bill. We read the details for you.'),
    (LucideIcons.mousePointerClick, 'Tap a few answers', 'About a minute to know exactly which licence you need.'),
    (LucideIcons.fileCheck2, 'AI fills, experts check', 'Forms and documents prepared and reviewed before filing.'),
    (LucideIcons.send, 'We file it with you', 'A quick call for the OTP and government fee on the official FoSCoS portal.'),
  ];
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('How it works', style: t(20, w: w8, c: C.slate900)),
            const SizedBox(height: 14),
            for (final (i, (icon, title, text)) in steps.indexed)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  IconBadge(icon, size: 42, fg: Colors.white, gradient: G.violetDeep),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('STEP ${i + 1}', style: t(11, w: w7, c: C.violet500, ls: 0.6)),
                      Text(title, style: t(16, w: w8, c: C.slate900)),
                      Text(text, style: t(13.5, c: C.slate500, h: 1.4)),
                    ]),
                  ),
                ]),
              ),
          ]),
        ),
      );
}
