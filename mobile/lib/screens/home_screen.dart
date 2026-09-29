import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/format.dart';
import '../core/session.dart';
import '../core/store.dart';
import '../theme.dart';
import '../widgets/ui.dart';

const _stepOrder = ['photos', 'intake', 'summary', 'details', 'documents', 'forms', 'ready'];
const _stepLabel = {'photos': 'Photos', 'intake': 'Your business', 'summary': 'Your licence', 'details': 'Details', 'documents': 'Documents', 'forms': 'Forms', 'ready': 'Submit'};

// After our team has the application; later stages are updated by the operations team as the filing moves.
const _journey = [
  ('Submitted & paid', 'Application complete and government fee paid.'),
  ('Filing call', 'Our team calls you for the FoSCoS OTP.'),
  ('Filed on FoSCoS', 'You get the 17-digit FSSAI application number.'),
  ('FSSAI review', 'Scrutiny, and an inspection where applicable.'),
  ('Licence granted', 'Valid permanently under the 2026 rules; no renewals.'),
];

/// Services our experts offer (the web's landing list), each opening its heading in the catalogue.
const expertAreas = [
  (LucideIcons.palette, 'Label & Artwork Review', 'labels-claims', ['Mandatory declarations', 'Nutrition & claims check', 'Logo & licence number placement']),
  (LucideIcons.lifeBuoy, 'FSSAI Problem Solving', 'compliance', ['Rejections & queries', 'Notices & inspections', 'Suspension & appeals']),
  (LucideIcons.shieldCheck, 'Compliance & Food Safety', 'compliance', ['Annual returns', 'Hygiene & safety practices', 'Audit readiness']),
];

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    store.refreshAll();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        if (!store.appLoaded) return const PageList(children: [LoadingBlocks()]);
        final app = store.app;
        final r = store.plan;
        final ready = store.ready;
        final stepIdx = app == null ? -1 : _stepOrder.indexOf(app['step'] as String? ?? 'photos');
        final pct = ready ? 100 : (stepIdx / (_stepOrder.length - 1) * 100).round().clamp(5, 100);
        final summary = asList(store.intake['summary']);
        String? row(String id) => summary.where((x) => x['id'] == id).map((x) => x['value'] as String?).firstOrNull;
        final result = asMap(r['result']);
        final licence = result['licence'] as String?;
        final info = asMap(app?['info']);
        final docs = asList(r['docs']).where((d) => d['optional'] != true).toList();
        final docsDone = docs.where((d) => isDocOk(store.docs[d['id']])).length;
        final started = app != null && stepIdx > 0;

        return PageList(
          onRefresh: store.refreshAll,
          children: spaced([
            GradientHero(
              radius: 32,
              padding: const EdgeInsets.all(24),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Namaste ${session.firstName} 👋', style: t(17, w: w6, c: Colors.white.withValues(alpha: 0.9))),
                const SizedBox(height: 4),
                if (ready) ...[
                  Text('Your application is with our team 🎉', style: t(27, w: w8, c: Colors.white, h: 1.15)),
                  const SizedBox(height: 8),
                  Text.rich(TextSpan(style: t(16, c: Colors.white.withValues(alpha: 0.9), h: 1.45), children: [
                    const TextSpan(text: "We'll call you on "),
                    TextSpan(text: '${info['mobile'] ?? session.user?['phone'] ?? ''}', style: const TextStyle(fontWeight: w7)),
                    const TextSpan(text: ' to file it on FoSCoS. Keep your phone handy for the OTP.'),
                  ])),
                  const SizedBox(height: 18),
                  _HeroButton(label: 'View my application', icon: LucideIcons.fileText, onTap: () => context.go('/apply')),
                ] else ...[
                  Text(started ? "Let's finish your licence application" : "Let's find the licence you need", style: t(27, w: w8, c: Colors.white, h: 1.15)),
                  const SizedBox(height: 16),
                  Row(children: [
                    Expanded(child: Text('Next: ${_stepLabel[app?['step']] ?? 'Photos'}', style: t(14, w: w6, c: Colors.white.withValues(alpha: 0.85)))),
                    Text('${app == null ? 0 : pct}%', style: t(14, w: w6, c: Colors.white.withValues(alpha: 0.85))),
                  ]),
                  const SizedBox(height: 6),
                  ProgressBar(value: app == null ? 0 : pct / 100, height: 10, track: Colors.white.withValues(alpha: 0.25), gradient: const LinearGradient(colors: [Colors.white, Colors.white])),
                  const SizedBox(height: 18),
                  _HeroButton(label: started ? 'Continue' : 'Start now', trailing: LucideIcons.arrowRight, onTap: () => context.go('/apply')),
                ],
              ]),
            ),
            _Tile(
              emoji: '🏛️',
              label: 'Your licence',
              value: r['intakeDone'] == true ? (licence ?? (result['outcome'] == 'handover' ? 'Expert to confirm' : 'Not needed')) : 'Not worked out yet',
              note: r['intakeDone'] == true && licence != null ? 'Form ${r['kind']} · govt fee ${rupees(result['fee'] ?? 0)}/year' : 'A few taps to find out',
              onTap: () => context.go('/apply'),
            ),
            _Tile(
              emoji: '📂',
              label: 'Documents',
              value: docs.isNotEmpty ? '$docsDone of ${docs.length} ready' : '${store.docs.values.where(isDocOk).length} uploaded',
              note: docsDone < docs.length ? 'Still needed: ${docs.length - docsDone}' : docs.isNotEmpty ? 'All required documents in' : 'Kept safe in your vault',
              onTap: () => context.go('/vault'),
            ),
            _Tile(
              emoji: '📍',
              label: 'Premises',
              value: info['city'] ?? row('place') ?? 'Not added yet',
              note: info['premises_address'] ?? row('state') ?? 'Added during your application',
              onTap: () => context.push('/premises'),
            ),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const SectionTitle('What happens next', icon: LucideIcons.phoneCall),
                const SizedBox(height: 16),
                for (final (i, (title, text)) in _journey.indexed)
                  _JourneyStep(n: i + 1, title: title, text: text, done: ready && i == 0, current: ready ? i == 1 : i == 0, last: i == _journey.length - 1),
              ]),
            ),
            Text('Our experts can also help with', style: t(20, w: w8, c: C.slate900)),
            for (final (icon, title, head, points) in expertAreas)
              AppCard(
                onTap: () => context.push('/catalogue?head=$head'),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  IconBadge(icon),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(title, style: t(16.5, w: w8, c: C.slate900)),
                      const SizedBox(height: 3),
                      Text(points.join(' · '), style: t(13.5, c: C.slate500, h: 1.4)),
                      const SizedBox(height: 8),
                      Row(children: [Text('Ask an expert', style: t(14, w: w7, c: C.violet600)), const SizedBox(width: 4), const Icon(LucideIcons.arrowRight, size: 14, color: C.violet600)]),
                    ]),
                  ),
                ]),
              ),
          ]),
        );
      },
    );
  }
}

class _HeroButton extends StatelessWidget {
  const _HeroButton({required this.label, this.icon, this.trailing, required this.onTap});
  final String label;
  final IconData? icon;
  final IconData? trailing;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        elevation: 2,
        shadowColor: const Color(0x33000000),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (icon != null) ...[Icon(icon, size: 18, color: C.violet700), const SizedBox(width: 8)],
              Text(label, style: t(16, w: w7, c: C.violet700)),
              if (trailing != null) ...[const SizedBox(width: 8), Icon(trailing, size: 18, color: C.violet700)],
            ]),
          ),
        ),
      );
}

class _Tile extends StatelessWidget {
  const _Tile({required this.emoji, required this.label, required this.value, required this.note, required this.onTap});
  final String emoji, label, value, note;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => AppCard(
        onTap: onTap,
        child: Row(children: [
          Text(emoji, style: const TextStyle(fontSize: 32)),
          const SizedBox(width: 16),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: t(13.5, w: w6, c: C.slate500)),
              Text(value, style: t(19, w: w8, c: C.slate900, h: 1.25)),
              Text(note, maxLines: 1, overflow: TextOverflow.ellipsis, style: t(13.5, c: C.slate500)),
            ]),
          ),
          const Icon(LucideIcons.arrowRight, size: 16, color: C.slate300),
        ]),
      );
}

class _JourneyStep extends StatelessWidget {
  const _JourneyStep({required this.n, required this.title, required this.text, required this.done, required this.current, required this.last});
  final int n;
  final String title, text;
  final bool done, current, last;
  @override
  Widget build(BuildContext context) => IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Column(children: [
            Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: done ? C.emerald500 : current ? C.violet600 : C.slate100,
                border: current ? Border.all(color: C.violet100, width: 4, strokeAlign: BorderSide.strokeAlignOutside) : null,
              ),
              child: done ? const Icon(LucideIcons.circleCheck, size: 17, color: Colors.white) : Text('$n', style: t(13, w: w8, c: current ? Colors.white : C.slate400)),
            ),
            if (!last) Expanded(child: Container(width: 2, margin: const EdgeInsets.symmetric(vertical: 4), color: C.slate100)),
          ]),
          const SizedBox(width: 14),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(top: 6, bottom: last ? 0 : 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: t(15, w: w8, c: done || current ? C.slate900 : C.slate400)),
                const SizedBox(height: 2),
                Text(text, style: t(13, c: C.slate500, h: 1.4)),
              ]),
            ),
          ),
        ]),
      );
}
