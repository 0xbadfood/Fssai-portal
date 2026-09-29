import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/store.dart';
import '../../theme.dart';
import '../../widgets/ui.dart';
import 'steps.dart';

const applySteps = [
  ('photos', 'Photos', C.pink500),
  ('intake', 'Your business', C.violet500),
  ('summary', 'Your licence', C.fuchsia500),
  ('details', 'Details', C.orange500),
  ('documents', 'Documents', C.amber500),
  ('forms', 'Forms', C.emerald500),
  ('ready', 'Done', C.sky500),
];

/// My Application: photo-first, then the tap-first intake, the licence, details, documents, the filled form and
/// submission. The server works out everything (app.plan, app.intake); this screen only shows it.
class ApplyScreen extends StatefulWidget {
  const ApplyScreen({super.key});
  @override
  State<ApplyScreen> createState() => _ApplyScreenState();
}

class _ApplyScreenState extends State<ApplyScreen> {
  final scroll = ScrollController();
  String? lastStep;

  @override
  void initState() {
    super.initState();
    store.ensureApplication();
    store.loadDocs();
    store.loadConfig();
    store.addListener(_onStore);
  }

  @override
  void dispose() {
    store.removeListener(_onStore);
    super.dispose();
  }

  // A new step starts at the top.
  void _onStore() {
    final step = store.app?['step'] as String?;
    if (step != null && step != lastStep) {
      final first = lastStep == null;
      lastStep = step;
      if (!first && scroll.hasClients) scroll.animateTo(0, duration: const Duration(milliseconds: 350), curve: Curves.easeOut);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final app = store.app;
        if (app == null) {
          return DecoratedBox(
            decoration: const BoxDecoration(gradient: G.page),
            child: Center(
              child: store.error.isNotEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Notice(store.error),
                        const SizedBox(height: 12),
                        BigButton(label: 'Try again', expand: false, onPressed: () {
                          store.appLoaded = false;
                          store.ensureApplication();
                        }),
                      ]),
                    )
                  : const Spinner(),
            ),
          );
        }
        final r = store.plan;
        final notReady = app['status'] != 'ready';
        final intakeDone = r['intakeDone'] == true, kind = r['kind'] != null;
        final noMissingFields = (r['missingFields'] as List? ?? []).isEmpty;
        final noMissingDocs = (r['missingDocs'] as List? ?? []).isEmpty;
        final reachable = {
          'photos': notReady,
          'intake': notReady,
          'summary': intakeDone && notReady,
          'details': intakeDone && kind && notReady,
          'documents': intakeDone && kind && noMissingFields && notReady,
          'forms': intakeDone && kind && noMissingFields && noMissingDocs && notReady,
          'ready': !notReady || r['ready'] == true,
        };
        final step = app['step'] as String? ?? 'photos';
        final current = applySteps.indexWhere((s) => s.$1 == step);

        return PageList(
          controller: scroll,
          onRefresh: () async {
            await store.loadCurrent();
            await store.loadDocs();
          },
          children: spaced([
            GradientHero(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Icon(LucideIcons.sparkles, size: 15, color: Colors.white),
                  const SizedBox(width: 6),
                  Text('AI-powered FSSAI assistant', style: t(13, w: w6, c: Colors.white.withValues(alpha: 0.9))),
                ]),
                const SizedBox(height: 6),
                Text(notReady ? 'Get your food licence — just tap and go' : 'Your application is ready 🎉', style: t(24, w: w8, c: Colors.white, h: 1.2)),
                const SizedBox(height: 16),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: [
                    for (final (i, (id, label, tone)) in applySteps.indexed)
                      Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: _StepChip(
                          n: i + 1,
                          label: label,
                          tone: tone,
                          active: id == step,
                          done: i < current || !notReady,
                          onTap: reachable[id] == true && id != step && !store.busy ? () => store.go(id) : null,
                        ),
                      ),
                  ]),
                ),
              ]),
            ),
            if (store.error.isNotEmpty) Notice(store.error),
            // Not const: the steps read the store, so they must rebuild with it.
            switch (step) {
              'photos' => PhotosStep(),
              'intake' => IntakeStep(scroll: scroll),
              'summary' => SummaryStep(),
              'details' => DetailsStep(key: ValueKey('details-${app['id']}')),
              'documents' => DocumentsStep(),
              'forms' => FormsStep(),
              _ => ReadyStep(),
            },
          ]),
        );
      },
    );
  }
}

class _StepChip extends StatelessWidget {
  const _StepChip({required this.n, required this.label, required this.tone, required this.active, required this.done, this.onTap});
  final int n;
  final String label;
  final Color tone;
  final bool active;
  final bool done;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final bg = active ? Colors.white : done ? Colors.white.withValues(alpha: 0.25) : Colors.white.withValues(alpha: 0.1);
    final fg = active ? C.violet700 : done ? Colors.white : Colors.white.withValues(alpha: 0.6);
    return Material(
      color: bg,
      shape: const StadiumBorder(),
      elevation: active ? 2 : 0,
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(6, 6, 12, 6),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 20,
              height: 20,
              alignment: Alignment.center,
              decoration: BoxDecoration(shape: BoxShape.circle, color: active ? tone : done ? Colors.white.withValues(alpha: 0.3) : Colors.white.withValues(alpha: 0.15)),
              child: done && !active ? const Icon(LucideIcons.check, size: 12, color: Colors.white) : Text('$n', style: t(10, w: w7, c: Colors.white)),
            ),
            const SizedBox(width: 6),
            Text(label, style: t(13, w: w7, c: fg)),
          ]),
        ),
      ),
    );
  }
}
