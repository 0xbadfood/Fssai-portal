import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../core/store.dart';
import '../theme.dart';
import '../widgets/ui.dart';

const _faqs = [
  ('How do I find out which licence I need?',
      'Open My Application and tap a few answers about your business. It takes about a minute and tells you whether you need Basic Registration, a State Licence or a Central Licence.'),
  ('Who files my application on the government portal?',
      'We do, with you. Once your application is ready, our team calls you: FoSCoS sends you an OTP, and the government fee is paid in your name.'),
  ('How long does approval take?', 'Once filed with complete documents, most applications are decided in about 15–30 days. It varies by state and licence type.'),
  ('Do I need to renew my licence?',
      'No. Under the 2026 framework, registrations and licences stay valid unless they are suspended, cancelled or surrendered. You only apply for a modification if your business details change.'),
  ('I have more than one place of business.',
      'Each place needs its own registration or licence (transporters are licensed once). Send us a request under "Another place of business" and we will set them up.'),
];

const _status = {
  'open': ('Received', C.amber50, C.amber700),
  'in_progress': ('In progress', C.sky50, C.sky700),
  'closed': ('Resolved', C.emerald50, C.emerald700),
};

/// Talk to an expert: a request with a topic and how to reach you, your earlier requests, and quick answers.
class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key, this.topic});
  final String? topic;
  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  String topic = '';
  String contactVia = 'call';
  final message = TextEditingController();
  List<Json> requests = [];
  bool busy = false, sent = false;
  String error = '';
  int open = -1;

  @override
  void initState() {
    super.initState();
    topic = widget.topic ?? '';
    store.loadConfig().then((_) {
      if (mounted && !(store.config?.supportTopics.any((t) => t['id'] == topic) ?? false)) setState(() => topic = '');
    });
    api.get('/api/support').then((d) => mounted ? setState(() => requests = asList(d['requests'])) : null).catchError((_) => null);
    message.addListener(() => setState(() {}));
  }

  Future<void> submit() async {
    setState(() {
      busy = true;
      error = '';
      sent = false;
    });
    try {
      final d = await api.post('/api/support', {'topic': topic, 'message': message.text, 'contactVia': contactVia});
      setState(() {
        requests = [asMap(d['request']), ...requests];
        message.clear();
        sent = true;
      });
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final topics = store.config?.supportTopics ?? [];
    final contacts = store.config?.contactVia ?? [];
    final me = session.user ?? {};
    String topicLabel(String id) => topics.where((t) => t['id'] == id).map((t) => t['label'] as String).firstOrNull ?? id;

    return Scaffold(
      appBar: AppBar(title: const Text('Support'), backgroundColor: const Color(0xFFFAF9FF)),
      body: PageList(children: spaced([
        const PageHeader(emoji: '🛟', title: 'Talk to an expert', subtitle: 'Licences, labels, notices or anything else about FSSAI. Tell us what you need and an expert will get back to you.'),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('What is it about?', style: t(16, w: w8, c: C.slate900)),
            const SizedBox(height: 10),
            for (final tp in topics)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: topic == tp['id'] ? C.violet50 : Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: topic == tp['id'] ? C.violet500 : C.slate100, width: 2)),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => setState(() => topic = tp['id'] as String),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      child: Row(children: [
                        Text(tp['emoji'] ?? '', style: const TextStyle(fontSize: 20)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(tp['label'] ?? '', style: t(15, w: w7, c: topic == tp['id'] ? C.violet800 : C.slate700)),
                            if (tp['example'] != null) Text(tp['example'], style: t(12.5, w: w5, c: C.slate500)),
                          ]),
                        ),
                      ]),
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 10),
            LabeledField(label: 'Tell us a little more', controller: message, maxLines: 4, maxLength: 2000, hint: 'e.g. We got an improvement notice after an inspection last week.'),
            const SizedBox(height: 16),
            Text('How should we reach you?', style: t(16, w: w8, c: C.slate900)),
            const SizedBox(height: 8),
            Wrap(spacing: 8, children: [for (final c in contacts) Pill(label: c['label'] ?? '', on: contactVia == c['id'], dense: true, onTap: () => setState(() => contactVia = c['id'] as String))]),
            const SizedBox(height: 8),
            Text("We'll use ${contactVia == 'email' ? me['email'] : (me['phone'] ?? 'the number on your account')}.", style: t(13.5, c: C.slate500)),
            if (error.isNotEmpty) ...[const SizedBox(height: 14), Notice(error)],
            if (sent) ...[const SizedBox(height: 14), const Notice('Sent. An expert will get back to you.', tone: 'green', icon: LucideIcons.circleCheck)],
            const SizedBox(height: 18),
            BigButton(label: 'Send to an expert', icon: LucideIcons.send, busy: busy, onPressed: topic.isEmpty || message.text.trim().length < 5 ? null : submit),
          ]),
        ),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Your requests', style: t(18, w: w8, c: C.slate900)),
            const SizedBox(height: 10),
            if (requests.isEmpty) Text('Nothing yet. Requests you send show up here.', style: t(14, c: C.slate500)),
            for (final r in requests)
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: C.slate50, borderRadius: BorderRadius.circular(16)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(topicLabel(r['topic'] ?? ''), style: t(14.5, w: w7, c: C.slate800))),
                    if (_status[r['status']] != null) Tag(_status[r['status']]!.$1, bg: _status[r['status']]!.$2, fg: _status[r['status']]!.$3),
                  ]),
                  const SizedBox(height: 4),
                  Text(r['message'] ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: t(14, c: C.slate600, h: 1.4)),
                  const SizedBox(height: 4),
                  Text(day(r['createdAt']), style: t(12, c: C.slate400)),
                ]),
              ),
          ]),
        ),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Quick answers', style: t(18, w: w8, c: C.slate900)),
            const SizedBox(height: 10),
            for (final (i, (q, a)) in _faqs.indexed)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(color: open == i ? C.violet50 : C.slate50, borderRadius: BorderRadius.circular(16)),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => setState(() => open = open == i ? -1 : i),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text(q, style: t(14.5, w: w7, c: C.slate800, h: 1.35))),
                        Icon(open == i ? LucideIcons.minus : LucideIcons.plus, size: 15, color: C.slate500),
                      ]),
                      if (open == i) ...[const SizedBox(height: 8), Text(a, style: t(14, c: C.slate600, h: 1.5))],
                    ]),
                  ),
                ),
              ),
          ]),
        ),
      ])),
    );
  }
}
