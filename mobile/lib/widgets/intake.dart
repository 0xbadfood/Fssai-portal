import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/store.dart';
import '../theme.dart';
import 'ui.dart';

// The intake question as the server sends it (app.intake.question / the welcome chat's question): options, pages,
// state lists, typing. Shared by My Application and the welcome screen's licence check.

// Long option lists arrive with a page per option (none = 1) and a "More" label per further page. Pages open
// cumulatively; "Not sure" (exclusive) comes with the last page; the best guesses after an unclear typed answer
// come first whatever their page.
List<Json> visibleOptions(Json q, int shown, List<String> guesses) {
  final options = asList(q['options']);
  final first = [for (final id in guesses) ...options.where((o) => o['id'] == id)];
  final last = nextPage(q, shown) == null;
  final rest = options.where((o) => !guesses.contains(o['id']) && (o['exclusive'] == true ? last : ((o['page'] as int?) ?? 1) <= shown)).toList();
  return [...first, ...rest.where((o) => o['exclusive'] != true), ...rest.where((o) => o['exclusive'] == true)];
}

Json? nextPage(Json q, int shown) {
  for (final p in asList(q['pages'])) {
    if (p['page'] == shown + 1) return p;
  }
  return null;
}

const cardTones = [
  (C.orange50, C.amber100, C.orange200),
  (C.sky50, Color(0xFFCFFAFE), Color(0xFFBAE6FD)),
  (C.emerald50, Color(0xFFECFCCB), C.emerald200),
  (C.fuchsia50, C.pink100, Color(0xFFF5D0FE)),
  (C.violet50, Color(0xFFE0E7FF), C.violet200),
];

/// One question with its answers. [onAnswer] gets the payload for the server and the text to show as the user's
/// bubble. [compact] is the welcome chat's smaller style.
class QuestionPanel extends StatefulWidget {
  const QuestionPanel({super.key, required this.q, required this.onAnswer, required this.busy, this.guesses = const [], this.compact = false});
  final Json q;
  final void Function(Json payload, String shown) onAnswer;
  final bool busy;
  final List<String> guesses;
  final bool compact;

  @override
  State<QuestionPanel> createState() => _QuestionPanelState();
}

class _QuestionPanelState extends State<QuestionPanel> {
  List<String> picked = [];
  int shown = 1;
  bool allStates = false;
  bool typing = false;
  final text = TextEditingController();

  Json get q => widget.q;
  bool get multi => q['multi'] == true;
  bool get states => q['kind'] == 'states';
  String? get suggested => asMap(q['states'])['suggested'] as String?;

  @override
  void initState() {
    super.initState();
    if (states && suggested != null) picked = [suggested!];
  }

  @override
  void dispose() {
    text.dispose();
    super.dispose();
  }

  bool exclusive(String id) => asList(q['options']).any((o) => o['id'] == id && o['exclusive'] == true);

  void toggle(String id) => setState(() {
        if (picked.contains(id)) {
          picked = picked.where((x) => x != id).toList();
        } else if (!states && exclusive(id)) {
          picked = [id];
        } else {
          picked = [...picked.where((x) => states || !exclusive(x)), id];
        }
      });

  String labels(List<String> ids) => asList(q['options']).where((o) => ids.contains(o['id'])).map((o) => o['label']).join(', ');

  void tap(String id) {
    if (widget.busy) return;
    if (multi) return toggle(id);
    widget.onAnswer({'questionId': q['id'], 'optionIds': [id]}, labels([id]));
  }

  void tapState(String s) {
    if (widget.busy) return;
    if (multi) return toggle(s);
    widget.onAnswer({'questionId': q['id'], 'states': [s]}, s);
  }

  void submitMulti() => widget.onAnswer(
        states ? {'questionId': q['id'], 'states': picked} : {'questionId': q['id'], 'optionIds': picked},
        states ? picked.join(', ') : labels(picked),
      );

  void submitText() {
    final clean = text.text.trim();
    if (clean.isEmpty || widget.busy) return;
    widget.onAnswer({'questionId': q['id'], 'text': clean.length > 1000 ? clean.substring(0, 1000) : clean}, clean);
    text.clear();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.compact;
    final number = (q['number'] as int?) ?? 1;
    final more = nextPage(q, shown);
    final st = asMap(q['states']);
    final stateList = allStates ? asStrings(st['all']) : {...asStrings(st['popular']).take(c ? 8 : 99), ...picked}.toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(q['check'] == true ? 'JUST CHECKING' : 'QUESTION $number', style: t(c ? 11 : 13, w: w7, c: C.violet500, ls: 0.6)),
        const SizedBox(height: 4),
        Text(q['title'] ?? '', style: t(c ? 17 : 24, w: w8, c: C.slate900, h: 1.25, ls: -0.3)),
        if (q['hint'] != null) ...[const SizedBox(height: 6), Text(q['hint'], style: t(c ? 13.5 : 15.5, c: C.slate500, h: 1.4))],
        if (states && suggested != null && picked.contains(suggested)) ...[
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerLeft,
            child: Tag('📸 From your address proof: ${multi ? 'add any others and tap Continue' : 'tap it to confirm'}', bg: C.pink50, fg: C.pink700),
          ),
        ],
        SizedBox(height: c ? 12 : 18),
        if (states) ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [for (final s in stateList) Pill(label: s, on: picked.contains(s), dense: true, onTap: widget.busy ? null : () => tapState(s))],
          ),
          if (!allStates)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(onPressed: () => setState(() => allStates = true), child: Text('Show all states & UTs', style: t(15, w: w7, c: C.violet600))),
            ),
        ] else ...[
          for (final (i, o) in visibleOptions(q, shown, widget.guesses).indexed)
            Padding(
              padding: EdgeInsets.only(bottom: c ? 8 : 10),
              child: _OptionCard(
                option: o,
                tone: cardTones[i % cardTones.length],
                on: picked.contains(o['id']),
                guess: widget.guesses.contains(o['id']),
                compact: c,
                onTap: widget.busy ? null : () => tap(o['id'] as String),
              ),
            ),
          if (more != null)
            _DashedButton(label: more['label'] ?? 'More', onTap: () => setState(() => shown = more['page'] as int)),
        ],
        if (multi) ...[
          const SizedBox(height: 14),
          BigButton(label: 'Continue', trailingIcon: LucideIcons.arrowRight, onPressed: picked.isEmpty || widget.busy ? null : submitMulti, small: c),
        ],
        if (q['typing'] == true && !c) ...[
          const SizedBox(height: 18),
          const Divider(),
          const SizedBox(height: 12),
          if (typing)
            _TypeBox(controller: text, hint: number == 1 ? 'e.g. I run a cloud kitchen' : q['id'] == 'turnover' ? 'e.g. about 80 lakh a year' : 'Type your answer…', onSend: submitText, busy: widget.busy)
          else
            InkWell(
              onTap: () => setState(() => typing = true),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(children: [
                  const Icon(LucideIcons.keyboard, size: 18, color: C.slate500),
                  const SizedBox(width: 8),
                  Expanded(child: Text(number == 1 ? 'Or describe your business in your own words' : 'None of these? Tell me in your own words', style: t(15, w: w6, c: C.slate500))),
                ]),
              ),
            ),
        ],
      ],
    );
  }
}

class _OptionCard extends StatelessWidget {
  const _OptionCard({required this.option, required this.tone, required this.on, required this.guess, required this.compact, this.onTap});
  final Json option;
  final (Color, Color, Color) tone;
  final bool on;
  final bool guess;
  final bool compact;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(compact ? 16 : 24);
    final (from, to, border) = tone;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      decoration: BoxDecoration(
        gradient: compact ? null : LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [from, to]),
        color: compact ? (on ? C.violet50 : guess ? const Color(0x99F5F3FF) : Colors.white) : null,
        borderRadius: r,
        border: Border.all(color: on ? C.violet500 : guess ? C.violet300 : compact ? C.violet100 : border, width: 2),
        boxShadow: on ? [BoxShadow(color: C.violet200.withValues(alpha: 0.9), blurRadius: 0, spreadRadius: compact ? 2 : 4)] : null,
      ),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          borderRadius: r,
          onTap: onTap,
          child: Padding(
            padding: EdgeInsets.all(compact ? 12 : 18),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (option['emoji'] != null) Text(option['emoji'], style: TextStyle(fontSize: compact ? 24 : 34, height: 1.1)),
                SizedBox(width: compact ? 10 : 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(option['label'] ?? '', style: t(compact ? 15 : 19, w: compact ? w7 : w8, c: C.slate900, h: 1.25)),
                      if (option['example'] != null) ...[
                        const SizedBox(height: 3),
                        Text(option['example'], style: t(compact ? 12.5 : 14, c: C.slate600, h: 1.35)),
                      ],
                    ],
                  ),
                ),
                if (on)
                  Container(
                    margin: const EdgeInsets.only(left: 6),
                    width: compact ? 22 : 28,
                    height: compact ? 22 : 28,
                    decoration: const BoxDecoration(color: C.violet600, shape: BoxShape.circle),
                    child: Icon(LucideIcons.check, size: compact ? 13 : 16, color: Colors.white),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DashedButton extends StatelessWidget {
  const _DashedButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
        color: const Color(0x66F5F3FF),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: const BorderSide(color: C.violet200, width: 2)),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(LucideIcons.chevronDown, size: 20, color: C.violet700),
              const SizedBox(width: 6),
              Flexible(child: Text(label, style: t(15.5, w: w7, c: C.violet700))),
            ]),
          ),
        ),
      );
}

class _TypeBox extends StatelessWidget {
  const _TypeBox({required this.controller, required this.hint, required this.onSend, required this.busy});
  final TextEditingController controller;
  final String hint;
  final VoidCallback onSend;
  final bool busy;
  @override
  Widget build(BuildContext context) => Row(children: [
        Expanded(
          child: TextField(
            controller: controller,
            autofocus: true,
            textInputAction: TextInputAction.send,
            onSubmitted: (_) => onSend(),
            style: t(16, c: C.slate900),
            decoration: InputDecoration(hintText: hint),
          ),
        ),
        const SizedBox(width: 8),
        ValueListenableBuilder(
          valueListenable: controller,
          builder: (_, v, _) => IconButton.filled(
            style: IconButton.styleFrom(backgroundColor: C.violet600, disabledBackgroundColor: C.violet200, fixedSize: const Size(52, 52), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
            onPressed: busy || v.text.trim().isEmpty ? null : onSend,
            icon: const Icon(LucideIcons.send, color: Colors.white, size: 20),
          ),
        ),
      ]);
}
