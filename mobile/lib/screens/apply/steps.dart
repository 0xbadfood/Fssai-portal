import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/session.dart';
import '../../core/store.dart';
import '../../theme.dart';
import '../../widgets/doc_card.dart';
import '../../widgets/intake.dart';
import '../../widgets/ui.dart';

String _formName(dynamic kind) => kind == 'A' ? 'Form A' : 'Form B';
String _label(String docTypeId) => store.config?.docLabel(docTypeId) ?? docTypeId;

// ---------------------------------------------------------------------------------------------------------------
// 1. Photos: every licence needs the photo ID, so it is asked for up front; a bill is optional (the premises address).

class PhotosStep extends StatelessWidget {
  // ignore: prefer_const_constructors_in_immutables
  PhotosStep({super.key});
  static const readLabels = {'applicant_name': 'Name', 'premises_address': 'Address', 'city': 'City', 'pincode': 'PIN code', 'state': 'State'};

  @override
  Widget build(BuildContext context) {
    final read = asMap(store.plan['readFromDocs']);
    final done = isDocOk(store.docs['identity']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: spaced([
        Tint(
          color: C.pink50,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text("Let's start with a photo of your ID 📸", style: t(22, w: w8, c: C.slate900, h: 1.25)),
            const SizedBox(height: 8),
            Text('We read your name from it, so you type less later. Take a clear photo, or upload the PDF if you have one (e-Aadhaar).', style: t(16, c: C.slate600, h: 1.45)),
          ]),
        ),
        DocumentCard(docTypeId: 'identity', label: 'Your photo ID', tag: 'Aadhaar, PAN, Voter ID, Passport or Driving Licence', doc: store.docs['identity']),
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text.rich(TextSpan(children: [
            TextSpan(text: 'Optional: ', style: t(15, w: w7, c: C.slate700)),
            TextSpan(text: "add a recent bill for your premises and we'll read the address from it too.", style: t(15, c: C.slate500)),
          ])),
          const SizedBox(height: 8),
          DocumentCard(docTypeId: 'address', label: '${_label('address')} (optional)', tag: 'Electricity, water or phone bill, or a bank statement', doc: store.docs['address']),
        ]),
        if (read.isNotEmpty)
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('What we read', style: t(19, w: w8, c: C.slate900)),
              const SizedBox(height: 10),
              KeyValues([for (final e in readLabels.entries) if (read[e.key] != null) (e.value, show(asMap(read[e.key])['value']))], labelWidth: 90),
              const SizedBox(height: 8),
              Text('You can correct anything later in the Details step.', style: t(13, c: C.slate500)),
            ]),
          ),
        BigButton(
          label: done ? 'Continue' : 'Skip for now',
          trailingIcon: LucideIcons.arrowRight,
          tone: done ? Tone.violet : Tone.white,
          onPressed: store.busy ? null : () => store.go('intake'),
        ),
        if (!done) Text("You can add it later — we'll ask again at the Documents step.", textAlign: TextAlign.center, style: t(14, c: C.slate500)),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 2. Intake: the question, its options and the order of the conversation come from the server (app.intake).

class IntakeStep extends StatefulWidget {
  const IntakeStep({super.key, required this.scroll});
  final ScrollController scroll;
  @override
  State<IntakeStep> createState() => _IntakeStepState();
}

class _IntakeStepState extends State<IntakeStep> {
  final questionKey = GlobalKey();
  String? pending;

  Future<void> answer(Json payload, String shown) async {
    setState(() => pending = shown);
    await store.answer(payload);
    if (!mounted) return;
    setState(() => pending = null);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = questionKey.currentContext;
      if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 400), curve: Curves.easeOut, alignment: 0.05);
    });
  }

  @override
  Widget build(BuildContext context) {
    final app = store.app!;
    final q = store.intake['question'] == null ? null : asMap(store.intake['question']);
    final clarify = asMap(store.intake['clarify']);
    final transcript = asList(app['transcript']);
    if (q == null) return const SizedBox.shrink();
    final guesses = clarify['questionId'] == q['id'] ? asStrings(clarify['guesses']) : <String>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: spaced([
        Bubble(
          child: transcript.isEmpty
              ? Text.rich(TextSpan(children: [
                  TextSpan(text: "Namaste ${session.firstName}! 👋 I'll work out exactly which FSSAI licence you need. "),
                  TextSpan(text: 'Just tap your answers', style: t(16.5, w: w7, c: C.slate800)),
                  const TextSpan(text: ' — it takes about a minute.'),
                ]))
              : const Text("Great, let's keep going!"),
        ),
        for (final m in transcript) ...[
          UserBubble(m['answer'] ?? ''),
          if (m['reply'] != null) Bubble(small: true, child: Text(m['reply'])),
        ],
        if (pending != null && store.busy) UserBubble(pending!),
        const ChatControls(),
        if (store.busy)
          const Bubble(small: true, child: TypingDots())
        else
          AppCard(
            key: questionKey,
            padding: const EdgeInsets.all(20),
            child: QuestionPanel(key: ValueKey('${q['id']}|${q['title']}'), q: q, busy: store.busy, guesses: guesses, onAnswer: answer),
          ),
      ], 12),
    );
  }
}

/// Undo last answer / Start over (with a confirmation), under the conversation.
class ChatControls extends StatelessWidget {
  const ChatControls({super.key});
  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: store, builder: (context, _) => _build(context));

  Widget _build(BuildContext context) {
    if (asList(store.app?['transcript']).isEmpty) return const SizedBox.shrink();
    return Row(children: [
      Expanded(child: BigButton(label: 'Undo last', icon: LucideIcons.undo2, tone: Tone.white, small: true, onPressed: store.busy ? null : store.undo)),
      const SizedBox(width: 10),
      Expanded(
        child: BigButton(
          label: 'Start over',
          icon: LucideIcons.rotateCcw,
          tone: Tone.white,
          small: true,
          onPressed: store.busy
              ? null
              : () async {
                  if (await confirm(context, title: 'Clear all answers?', body: 'Your documents and details stay; only the questions start again.', yes: 'Yes, start over', danger: true)) {
                    store.restart();
                  }
                },
        ),
      ),
    ]);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 3. Summary: the licence (graph rules on the server), what was understood, and the way ahead.

const _verdict = {
  'registration': ([C.emerald500, C.lime500], '🌱', 'The simplest one — for small food businesses.'),
  'central_registration': ([C.teal500, C.emerald500], '🚉', 'Registration on the central route, for small businesses at railway, airport or central-government premises.'),
  'state': ([C.orange500, C.amber500], '🏢', 'For medium-sized food businesses, issued by your state.'),
  'central': ([C.violet600, C.fuchsia500], '🏛️', 'Issued by FSSAI centrally — for large or special-category businesses.'),
};

class SummaryStep extends StatelessWidget {
  // ignore: prefer_const_constructors_in_immutables
  SummaryStep({super.key});

  @override
  Widget build(BuildContext context) {
    final r = store.plan;
    final e = asMap(r['result']);
    final kind = r['kind'];
    final required = asList(r['docs']).where((d) => d['optional'] != true).toList();
    final style = _verdict[e['licenceId']];
    final reasons = asStrings(e['reasons']);
    final handover = asStrings(e['handover']);
    final filingCall = asList(r['filingCall']);
    final white90 = Colors.white.withValues(alpha: 0.9);

    Widget hero;
    if (e['outcome'] == 'notfood') {
      hero = GradientHero(gradient: G.of(C.sky500, C.indigo500), shadow: null, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('👍', style: TextStyle(fontSize: 44)),
        const SizedBox(height: 8),
        Text("You don't need FSSAI approval", style: t(26, w: w8, c: Colors.white, h: 1.2)),
        const SizedBox(height: 8),
        if (reasons.isNotEmpty) Text(reasons.first, style: t(16, c: white90, h: 1.4)),
        const SizedBox(height: 6),
        Text(e['guidance'] ?? '', style: t(15, c: Colors.white.withValues(alpha: 0.8), h: 1.4)),
      ]));
    } else if (e['outcome'] == 'deemed') {
      hero = GradientHero(gradient: G.of(C.teal500, C.emerald500), shadow: null, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('🎉', style: TextStyle(fontSize: 44)),
        const SizedBox(height: 8),
        Text("Good news — you don't need to apply!", style: t(26, w: w8, c: Colors.white, h: 1.2)),
        const SizedBox(height: 8),
        if (reasons.isNotEmpty) Text(reasons.first, style: t(16, c: white90, h: 1.4)),
        const SizedBox(height: 6),
        Text(e['guidance'] ?? '', style: t(15, c: Colors.white.withValues(alpha: 0.8), h: 1.4)),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(18)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(e['upsell'] ?? '', style: t(15, c: Colors.white, h: 1.4)),
            const SizedBox(height: 12),
            BigButton(label: 'Apply for FSSAI Registration anyway', tone: Tone.white, small: true, onPressed: store.busy ? null : () => store.update({'optInRegistration': true})),
          ]),
        ),
      ]));
    } else if (e['outcome'] == 'handover' || style == null) {
      hero = GradientHero(gradient: G.of(C.slate700, C.violet700), shadow: null, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('🧑‍⚖️', style: TextStyle(fontSize: 44)),
        const SizedBox(height: 8),
        Text('An expert will place your business', style: t(26, w: w8, c: Colors.white, h: 1.2)),
        const SizedBox(height: 8),
        Text("Your answers don't fit a standard FSSAI category exactly, so our FSSAI expert will confirm which licence you need.", style: t(16, c: white90, h: 1.4)),
        const SizedBox(height: 10),
        Bullets([...handover, ...reasons], style: t(15, c: Colors.white.withValues(alpha: 0.85), h: 1.4)),
        const SizedBox(height: 16),
        BigButton(label: 'Talk to an expert', icon: LucideIcons.messageCircle, tone: Tone.white, onPressed: () => context.push('/catalogue?head=licensing-approvals')),
      ]));
    } else {
      final (colors, emoji, blurb) = style;
      hero = GradientHero(gradient: G.of(colors[0], colors[1]), shadow: null, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Based on your answers, you need', style: t(15, w: w6, c: Colors.white.withValues(alpha: 0.85))),
        const SizedBox(height: 4),
        Text('$emoji  ${e['licence']}', style: t(28, w: w8, c: Colors.white, h: 1.2)),
        const SizedBox(height: 6),
        Text(blurb, style: t(16, c: white90, h: 1.4)),
        const SizedBox(height: 16),
        _Stat(label: 'Application form', value: _formName(kind), note: 'We fill it for you'),
        _Stat(label: 'Government fee', value: e['fee'] != null && e['fee'] != 0 ? rupees(e['fee']) : 'No fee', note: e['fee'] != null && e['fee'] != 0 ? 'per year' : 'for this registration'),
        _Stat(label: 'Documents', value: '${required.length}', note: 'photos to upload'),
        const SizedBox(height: 8),
        Bullets(reasons, style: t(15, c: white90, h: 1.4)),
        if (handover.isNotEmpty) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(18)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('An expert will confirm:', style: t(15, w: w7, c: Colors.white)),
              Bullets(handover, style: t(15, c: white90, h: 1.4)),
            ]),
          ),
        ],
        if (e['outcome'] == 'optin')
          TextButton(
            onPressed: () => store.update({'optInRegistration': false}),
            child: Text("Actually, I don't want to apply", style: t(14, w: w6, c: Colors.white).copyWith(decoration: TextDecoration.underline, decorationColor: Colors.white)),
          ),
      ]));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: spaced([
        hero,
        for (final task in asList(e['tasks']))
          Tint(
            color: const Color(0x99F5F3FF),
            border: C.violet100,
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const IconBadge(LucideIcons.plus, bg: Colors.white),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text.rich(TextSpan(children: [
                    TextSpan(text: task['label'], style: t(17, w: w8, c: C.slate900)),
                    if (task['licence'] != null)
                      TextSpan(text: '  ${task['licence']}${task['fee'] != null && task['fee'] != 0 ? ', ${rupees(task['fee'])}/year' : ''}', style: t(15, w: w6, c: C.violet700)),
                  ])),
                  const SizedBox(height: 4),
                  Text(task['text'] ?? '', style: t(15, c: C.slate600, h: 1.4)),
                ]),
              ),
            ]),
          ),
        _ResultCheck(provisional: e['provisional'] == true),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('What I understood', style: t(19, w: w8, c: C.slate900)),
            Text('Something wrong? Tap it to change — the result updates instantly.', style: t(14.5, c: C.slate500, h: 1.4)),
            const SizedBox(height: 12),
            for (final row in asList(store.intake['summary']))
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: C.slate50,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: C.slate100, width: 2)),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: store.busy ? null : () => store.reask(row['id'] as String),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      child: Row(children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(row['title'] ?? '', style: t(13, c: C.slate500, h: 1.3)),
                            Text(row['value'] ?? '', style: t(15.5, w: w7, c: C.slate800, h: 1.3)),
                          ]),
                        ),
                        const Icon(LucideIcons.pencil, size: 17, color: C.slate400),
                      ]),
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 8),
            const ChatControls(),
          ]),
        ),
        if (kind != null)
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Apply in 4 simple steps', style: t(19, w: w8, c: C.slate900)),
              const SizedBox(height: 12),
              _WayStep(n: 1, icon: LucideIcons.clipboardList, bg: C.orange100, fg: C.orange600, title: 'A few details', text: "Mostly taps — we've pre-filled what we know"),
              _WayStep(n: 2, icon: LucideIcons.folderUp, bg: C.amber100, fg: C.amber600, title: 'Upload photos', text: required.map((d) => _label(d['id'] as String)).join(', ')),
              _WayStep(n: 3, icon: LucideIcons.fileText, bg: C.emerald100, fg: C.emerald600, title: '${_formName(kind)} ready', text: 'Filled automatically — just check it'),
              _WayStep(n: 4, icon: LucideIcons.send, bg: C.sky100, fg: C.sky600, title: 'We submit', text: 'Our team files it and calls you for the OTP'),
              if (filingCall.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4, bottom: 8),
                  child: Text(
                    "We'll prepare these with you on the filing call: ${filingCall.map((d) => (d['label'] as String).replaceAll(RegExp(r' \(on letterhead\)$'), '')).join('; ')}.",
                    style: t(13.5, c: C.slate500, h: 1.4),
                  ),
                ),
              const SizedBox(height: 8),
              BigButton(label: "Let's start", trailingIcon: LucideIcons.arrowRight, onPressed: store.busy ? null : () => store.go('details')),
            ]),
          ),
        if (kind == null && e['outcome'] != 'handover')
          Row(children: [
            const Icon(LucideIcons.partyPopper, size: 18, color: C.slate500),
            const SizedBox(width: 8),
            Expanded(child: Text('Nothing more to do. You can change your answers above any time.', style: t(15, c: C.slate500))),
          ]),
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, required this.note});
  final String label, value, note;
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(16)),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label.toUpperCase(), style: t(11, w: w7, c: Colors.white.withValues(alpha: 0.75), ls: 0.5)),
              Text(note, style: t(13, c: Colors.white.withValues(alpha: 0.8))),
            ]),
          ),
          Text(value, style: t(22, w: w8, c: Colors.white)),
        ]),
      );
}

class _WayStep extends StatelessWidget {
  const _WayStep({required this.n, required this.icon, required this.bg, required this.fg, required this.title, required this.text});
  final int n;
  final IconData icon;
  final Color bg, fg;
  final String title, text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          IconBadge(icon, bg: bg, fg: fg),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Step $n', style: t(12.5, w: w7, c: C.slate400)),
              Text(title, style: t(16.5, w: w8, c: C.slate900)),
              Text(text, style: t(13.5, c: C.slate500, h: 1.35)),
            ]),
          ),
        ]),
      );
}

/// "Is this right?" on the result, logged for the expert's review.
class _ResultCheck extends StatefulWidget {
  const _ResultCheck({required this.provisional});
  final bool provisional;
  @override
  State<_ResultCheck> createState() => _ResultCheckState();
}

class _ResultCheckState extends State<_ResultCheck> {
  String? sent;
  @override
  Widget build(BuildContext context) => AppCard(
        padding: const EdgeInsets.all(18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (sent != null)
            Text('Thanks! ${sent == 'right' ? '🙏' : 'Our expert will take a look.'}', style: t(15.5, w: w6, c: C.slate600))
          else ...[
            Text('Is this right?', style: t(16, w: w7, c: C.slate800)),
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final (id, label) in [('right', '👍 Yes'), ('wrong', '👎 No'), ('unsure', '🤔 Not sure')])
                Pill(label: label, on: false, dense: true, onTap: () {
                  setState(() => sent = id);
                  store.rate(id);
                }),
            ]),
          ],
          if (widget.provisional) ...[
            const SizedBox(height: 10),
            Text('Worked out from the FoSCoS 2026 eligibility table. Our FSSAI expert is still reviewing these rules.', style: t(13, c: C.slate400, h: 1.4)),
          ],
        ]),
      );
}

// ---------------------------------------------------------------------------------------------------------------
// 4. Details: fields and pre-filled values come from the server (plan.fields, plan.prefill: documents, account, answers).

bool _filled(dynamic v) => v is List ? v.isNotEmpty : v is String ? v.trim().isNotEmpty : v != null;

class DetailsStep extends StatefulWidget {
  const DetailsStep({super.key});
  @override
  State<DetailsStep> createState() => _DetailsStepState();
}

class _DetailsStepState extends State<DetailsStep> {
  late Json info;
  late Json prefill;
  final ctl = <String, TextEditingController>{};

  Json get r => store.plan;
  Json get prefillInfo => asMap(asMap(r['prefill'])['info']);

  @override
  void initState() {
    super.initState();
    prefill = asMap(r['prefill']);
    info = Map.of(prefillInfo);
    store.addListener(_merge);
  }

  @override
  void dispose() {
    store.removeListener(_merge);
    store.flushDraft();
    for (final c in ctl.values) {
      c.dispose();
    }
    super.dispose();
  }

  // A later refresh (e.g. a document read) can fill remaining gaps; what the user typed stays.
  void _merge() {
    final next = asMap(r['prefill']);
    if (next.toString() == prefill.toString()) return;
    prefill = next;
    setState(() {
      info = {...asMap(next['info']), ...Map.fromEntries(info.entries.where((e) => _filled(e.value)))};
      for (final e in ctl.entries) {
        final v = info[e.key];
        if (v is String && e.value.text != v) e.value.text = v;
      }
    });
  }

  String? sourceOf(String id) {
    final p = prefillInfo;
    if (info[id] == null || info[id].toString() != p[id].toString()) return null;
    return asMap(prefill['sources'])[id] as String?;
  }

  void set(String id, dynamic v) {
    setState(() => info = {...info, id: v});
    store.saveDraft(info);
  }

  @override
  Widget build(BuildContext context) {
    final fields = asList(r['fields']);
    final missing = fields.where((f) => !_filled(info[f['id']])).toList();
    final sections = <String>[];
    for (final f in fields) {
      if (!sections.contains(f['section'])) sections.add(f['section'] as String);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: spaced([
        Tint(
          color: C.orange50,
          child: Text.rich(TextSpan(style: t(16, c: C.orange900, h: 1.45), children: [
            const TextSpan(text: '📝 A few details for your '),
            TextSpan(text: _formName(r['kind']), style: t(16, w: w8, c: C.orange900)),
            const TextSpan(text: ". We've filled in what we already know — just check and tap."),
          ])),
        ),
        for (final sec in sections)
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(sec, style: t(19, w: w8, c: C.slate900)),
              const SizedBox(height: 14),
              ...spaced([for (final f in fields.where((f) => f['section'] == sec)) _field(f)], 22),
            ]),
          ),
        BigButton(
          label: 'Continue to documents',
          trailingIcon: LucideIcons.arrowRight,
          onPressed: store.busy || missing.isNotEmpty ? null : () => store.update({'info': info, 'step': 'documents'}),
        ),
        Text(store.draftState == 'saved' ? '✓ Changes saved' : 'Saving…', textAlign: TextAlign.center, style: t(13.5, w: w5, c: C.slate400)),
        if (missing.isNotEmpty) Text('Still needed: ${missing.map((m) => m['label']).join(', ')}', textAlign: TextAlign.center, style: t(14.5, c: C.slate500, h: 1.4)),
      ]),
    );
  }

  Widget _field(Json f) {
    final id = f['id'] as String;
    final options = asStrings(f['options']);
    if (f['type'] == 'choice' && f['hideIfSingle'] == true && options.length == 1) return const SizedBox.shrink();
    final src = sourceOf(id);
    final fromDoc = src != null && (src.startsWith('your ID') || src.contains('proof'));
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, runSpacing: 4, children: [
        Text(f['label'] ?? '', style: t(16.5, w: w7, c: C.slate800)),
        if (src != null) Tag('${fromDoc ? '📸 ' : ''}from $src', bg: fromDoc ? C.pink50 : C.slate100, fg: fromDoc ? C.pink700 : C.slate500),
      ]),
      const SizedBox(height: 10),
      if (f['type'] == 'text')
        TextField(
          controller: ctl.putIfAbsent(id, () => TextEditingController(text: info[id] as String? ?? '')),
          keyboardType: switch (f['inputMode']) { 'tel' => TextInputType.phone, 'email' => TextInputType.emailAddress, 'numeric' => TextInputType.number, _ => TextInputType.text },
          textCapitalization: f['inputMode'] == null ? TextCapitalization.words : TextCapitalization.none,
          onChanged: (v) => set(id, v),
          style: t(17, c: C.slate900),
          decoration: InputDecoration(hintText: f['example'] != null ? 'e.g. ${f['example']}' : null),
        ),
      if (f['type'] == 'choice')
        Wrap(spacing: 8, runSpacing: 8, children: [for (final o in options) Pill(label: o, on: info[id] == o, onTap: () => set(id, o))]),
      if (f['type'] == 'multichoice') _MultiChoice(field: f, value: asStrings(info[id]), onChanged: (v) => set(id, v)),
    ]);
  }
}

class _MultiChoice extends StatefulWidget {
  const _MultiChoice({required this.field, required this.value, required this.onChanged});
  final Json field;
  final List<String> value;
  final ValueChanged<List<String>> onChanged;
  @override
  State<_MultiChoice> createState() => _MultiChoiceState();
}

class _MultiChoiceState extends State<_MultiChoice> {
  final adding = TextEditingController();
  void add() {
    final v = adding.text.trim();
    if (v.isNotEmpty && !widget.value.contains(v)) widget.onChanged([...widget.value, v]);
    adding.clear();
  }

  @override
  Widget build(BuildContext context) {
    final options = {...asStrings(widget.field['suggestions']), ...widget.value}.toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (final o in options)
          Pill(label: o, on: widget.value.contains(o), onTap: () => widget.onChanged(widget.value.contains(o) ? widget.value.where((x) => x != o).toList() : [...widget.value, o])),
      ]),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(child: TextField(controller: adding, onSubmitted: (_) => add(), textInputAction: TextInputAction.done, decoration: const InputDecoration(hintText: 'Something else? e.g. Mango pickle'))),
        const SizedBox(width: 8),
        IconButton.outlined(
          style: IconButton.styleFrom(fixedSize: const Size(52, 52), side: const BorderSide(color: C.slate200, width: 2), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
          onPressed: add,
          icon: const Icon(LucideIcons.plus, color: C.slate600),
        ),
      ]),
    ]);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 5. Documents: each one checked by the AI as it is added.

class DocumentsStep extends StatelessWidget {
  // ignore: prefer_const_constructors_in_immutables
  DocumentsStep({super.key});
  @override
  Widget build(BuildContext context) {
    final r = store.plan;
    final docs = asList(r['docs']);
    final required = docs.where((d) => d['optional'] != true).toList();
    final done = required.where((d) => isDocOk(store.docs[d['id']])).length;
    final missing = required.length - done;
    final filingCall = asList(r['filingCall']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: spaced([
        Tint(
          color: C.amber50,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text("📸 Take a clear photo of each document or upload its PDF — our AI checks it straight away and tells you if it's good to go.", style: t(16, c: C.amber900, h: 1.45)),
            const SizedBox(height: 14),
            Row(children: [
              Expanded(child: ProgressBar(value: required.isEmpty ? 1 : done / required.length)),
              const SizedBox(width: 12),
              Text('$done/${required.length}', style: t(16, w: w8, c: C.amber900)),
            ]),
          ]),
        ),
        for (final d in docs)
          DocumentCard(
            docTypeId: d['id'] as String,
            label: '${_label(d['id'] as String)}${d['optional'] == true ? ' (optional)' : ''}',
            tag: d['why'] as String?,
            doc: store.docs[d['id']],
          ),
        if (filingCall.isNotEmpty)
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text("We'll prepare these with you on the filing call", style: t(17, w: w8, c: C.slate900)),
              const SizedBox(height: 2),
              Text('Mostly short declarations on your letterhead. Nothing to upload now.', style: t(13.5, c: C.slate500)),
              const SizedBox(height: 10),
              Bullets([for (final d in filingCall) d['label'] as String]),
            ]),
          ),
        BigButton(label: 'See my ${_formName(r['kind'])}', trailingIcon: LucideIcons.arrowRight, onPressed: store.busy || missing > 0 ? null : () => store.go('forms')),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 6. Forms: filled on the server from the answers, details and documents.

class FormsStep extends StatelessWidget {
  // ignore: prefer_const_constructors_in_immutables
  FormsStep({super.key});
  @override
  Widget build(BuildContext context) {
    final form = asMap(store.plan['form']);
    final sections = asList(form['sections']);
    final gaps = sections.expand((s) => (s['rows'] as List)).where((row) => (row as List)[1] == null).length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: spaced([
        Tint(
          color: C.emerald50,
          child: Text.rich(TextSpan(style: t(16, c: C.emerald900, h: 1.45), children: [
            const TextSpan(text: '✨ We filled in your '),
            TextSpan(text: _formName(form['kind']), style: t(16, w: w8, c: C.emerald900)),
            const TextSpan(text: ' from your answers and documents. Give it a quick look.'),
          ])),
        ),
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: C.slate200)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Container(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
              decoration: const BoxDecoration(color: C.slate50, border: Border(bottom: BorderSide(color: C.slate300, width: 4))),
              child: Column(children: [
                Text('FOOD SAFETY AND STANDARDS (LICENSING AND REGISTRATION OF FOOD BUSINESSES) REGULATIONS', textAlign: TextAlign.center, style: t(10, w: w7, c: C.slate500, ls: 1, h: 1.4)),
                const SizedBox(height: 6),
                Text(form['title'] ?? '', textAlign: TextAlign.center, style: t(21, w: w8, c: C.slate900, h: 1.25)),
              ]),
            ),
            for (final (i, s) in sections.indexed)
              Container(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
                decoration: BoxDecoration(border: i == 0 ? null : const Border(top: BorderSide(color: C.slate100))),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${i + 1}. ${(s['title'] as String).toUpperCase()}', style: t(13, w: w8, c: C.slate500, ls: 0.4)),
                  const SizedBox(height: 10),
                  for (final row in (s['rows'] as List))
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 5),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(row[0].toString(), style: t(13.5, c: C.slate500)),
                        Text(row[1]?.toString() ?? 'Missing', style: t(15.5, w: w6, c: row[1] == null ? C.red600 : C.slate900, h: 1.35)),
                      ]),
                    ),
                ]),
              ),
          ]),
        ),
        BigButton(label: 'Looks good', trailingIcon: LucideIcons.arrowRight, tone: Tone.green, onPressed: store.busy || gaps > 0 ? null : () => store.go('ready')),
        BigButton(label: 'Change details', icon: LucideIcons.pencil, tone: Tone.white, onPressed: store.busy ? null : () => store.go('details')),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 7. Ready: pay the government fee and submit; afterwards, what happens next.

class ReadyStep extends StatelessWidget {
  // ignore: prefer_const_constructors_in_immutables
  ReadyStep({super.key});
  @override
  Widget build(BuildContext context) {
    final app = store.app!;
    final r = store.plan;
    if (app['status'] != 'ready') {
      return AppCard(
        padding: const EdgeInsets.all(24),
        child: Column(children: [
          const Text('🚀', style: TextStyle(fontSize: 48)),
          const SizedBox(height: 10),
          Text('All set to submit', style: t(26, w: w8, c: C.slate900)),
          const SizedBox(height: 8),
          Text(
            "Your ${_formName(r['kind'])} and documents are complete. Pay the government fee and we'll file it on the FSSAI portal for you.",
            textAlign: TextAlign.center,
            style: t(16, c: C.slate600, h: 1.45),
          ),
          const SizedBox(height: 20),
          BigButton(label: 'Pay the government fee and submit', icon: LucideIcons.send, tone: Tone.green, onPressed: store.busy || r['ready'] != true ? null : () => context.push('/payments')),
        ]),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: spaced([
        GradientHero(
          gradient: G.success,
          shadow: C.emerald100,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(LucideIcons.circleCheckBig, size: 44, color: Colors.white),
            const SizedBox(height: 10),
            Text('Submitted to our team 🎉', style: t(26, w: w8, c: Colors.white)),
            const SizedBox(height: 6),
            Text.rich(TextSpan(style: t(16, c: Colors.white.withValues(alpha: 0.9)), children: [
              const TextSpan(text: 'Reference '),
              TextSpan(text: (app['id'] as String).substring(0, 8).toUpperCase(), style: const TextStyle(fontWeight: w7, fontFamily: 'monospace')),
              TextSpan(text: ' · ${asMap(r['result'])['licence'] ?? ''}'),
            ])),
          ]),
        ),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SectionTitle('What happens next', icon: LucideIcons.phoneCall, iconColor: C.sky500),
            const SizedBox(height: 12),
            Text.rich(TextSpan(style: t(16, c: C.slate700, h: 1.5), children: [
              const TextSpan(text: '1. Our operations team will call you on '),
              TextSpan(text: '${asMap(app['info'])['mobile'] ?? ''}', style: const TextStyle(fontWeight: w7)),
              const TextSpan(text: '.\n2. Keep your phone handy: FoSCoS sends you an '),
              const TextSpan(text: 'OTP', style: TextStyle(fontWeight: w7)),
              const TextSpan(text: " to confirm the filing.\n3. We'll share the FSSAI application number once it's filed."),
            ])),
          ]),
        ),
        BigButton(label: 'Go to dashboard', tone: Tone.white, onPressed: () => context.go('/home')),
        BigButton(label: 'Start another application', icon: LucideIcons.rotateCcw, tone: Tone.white, onPressed: store.busy ? null : store.startNew),
      ]),
    );
  }
}
