import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/store.dart';
import '../../theme.dart';
import '../../widgets/ui.dart';
import '../payments_screen.dart';

const orderTone = {
  'awaiting_payment': (C.amber50, C.amber800),
  'quote_requested': (C.sky50, C.sky700),
  'quoted': (C.amber50, C.amber800),
  'new': (C.violet50, C.violet700),
  'in_progress': (C.violet50, C.violet700),
  'awaiting_customer': (C.orange50, C.orange800),
  'completed': (C.emerald50, C.emerald700),
  'cancelled': (C.slate100, C.slate500),
};

String unitsLabel(Json o) => '${o['quantity']} ${o['unit'] == 'SKU' ? 'SKUs' : '${o['unit']}s'}';

/// Experts tab: the customer's expert-service orders (bought, quoted), with what is due and the messages.
class MyServicesScreen extends StatefulWidget {
  const MyServicesScreen({super.key});
  @override
  State<MyServicesScreen> createState() => _MyServicesScreenState();
}

class _MyServicesScreenState extends State<MyServicesScreen> {
  List<Json>? orders;
  String error = '';

  Future<void> load() async {
    try {
      final d = await api.get('/api/orders');
      if (mounted) setState(() => orders = asList(d['orders']));
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    }
  }

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  Widget build(BuildContext context) {
    return PageList(
      onRefresh: load,
      children: spaced([
        const PageHeader(emoji: '🧑‍⚖️', title: 'My expert services', subtitle: 'Services you’ve bought or asked us to quote, and your messages with the expert.'),
        BigButton(label: 'Browse services', icon: LucideIcons.sparkles, onPressed: () => context.push('/catalogue')),
        if (error.isNotEmpty) Notice(error),
        if (orders == null && error.isEmpty) const LoadingBlocks(count: 2),
        if (orders?.isEmpty == true)
          AppCard(
            padding: const EdgeInsets.all(24),
            child: Column(children: [
              const Icon(LucideIcons.userCheck, size: 34, color: C.violet500),
              const SizedBox(height: 10),
              Text('No expert services yet', style: t(18, w: w8, c: C.slate900)),
              const SizedBox(height: 4),
              Text('Licences, labels, formulations, claims, notices and more: 127 services from a food regulatory expert.', textAlign: TextAlign.center, style: t(14.5, c: C.slate500, h: 1.4)),
              const SizedBox(height: 12),
              TextButton(onPressed: () => context.push('/catalogue'), child: Text('See what our expert can do →', style: t(15, w: w7, c: C.violet600))),
            ]),
          ),
        for (final o in orders ?? <Json>[]) _OrderCard(key: ValueKey(o['id']), order: o, onChange: load),
      ], 14),
    );
  }
}

class _OrderCard extends StatefulWidget {
  const _OrderCard({super.key, required this.order, required this.onChange});
  final Json order;
  final Future<void> Function() onChange;
  @override
  State<_OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends State<_OrderCard> {
  late bool open = widget.order['status'] == 'awaiting_customer';
  List<Json>? thread;
  final text = TextEditingController();
  bool busy = false;
  String error = '';

  Json get o => widget.order;

  @override
  void initState() {
    super.initState();
    if (open) loadThread();
    text.addListener(() => setState(() {}));
  }

  Future<void> loadThread() async {
    try {
      final d = await api.get('/api/orders/${o['id']}');
      if (mounted) setState(() => thread = asList(d['messages']));
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    }
  }

  Future<void> act(String path, [Json? body]) async {
    setState(() {
      busy = true;
      error = '';
    });
    try {
      await api.post('/api/orders/${o['id']}/$path', body ?? {});
      text.clear();
      await loadThread();
      await widget.onChange();
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final due = o['due'] == null ? null : asMap(o['due']);
    final unpaidStart = o['status'] == 'awaiting_payment';
    final tone = orderTone[o['status']] ?? (C.slate100, C.slate600);
    final closed = ['cancelled', 'completed'].contains(o['status']);

    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.all(18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${o['ref']} · ${when(o['createdAt'])}'.toUpperCase(), style: t(11.5, w: w7, c: C.slate400, ls: 0.5)),
            const SizedBox(height: 4),
            GestureDetector(onTap: () => context.push('/catalogue/${o['serviceId']}'), child: Text(o['serviceName'] ?? '', style: t(17, w: w8, c: C.slate900, h: 1.3))),
            if (o['unit'] != null && (o['quantity'] as num? ?? 1) > 1) Text(unitsLabel(o), style: t(13.5, c: C.slate500)),
            const SizedBox(height: 10),
            Row(children: [
              Tag(o['statusLabel'] ?? '', bg: tone.$1, fg: tone.$2),
              const Spacer(),
              if (['awaiting_payment', 'quote_requested', 'quoted'].contains(o['status']))
                TextButton(
                  onPressed: busy
                      ? null
                      : () async {
                          if (await confirm(context, title: 'Cancel this order?', yes: 'Cancel order', no: 'Keep it', danger: true)) act('cancel');
                        },
                  child: Text('Cancel', style: t(13, w: w6, c: C.slate400)),
                ),
            ]),
            if (due != null) ...[
              const SizedBox(height: 12),
              BigButton(label: 'Pay ${rupees(due['total'])}', trailingIcon: LucideIcons.arrowRight, onPressed: () => context.push('/orders/${o['id']}/pay')),
              if (due['kind'] == 'quote') Padding(padding: const EdgeInsets.only(top: 6), child: Text('Quote from the expert', textAlign: TextAlign.center, style: t(12.5, c: C.slate500))),
              if (due['kind'] == 'topup') Padding(padding: const EdgeInsets.only(top: 6), child: Text('Top-up for additional work', textAlign: TextAlign.center, style: t(12.5, c: C.slate500))),
            ],
            if (due?['note'] != null) ...[
              const SizedBox(height: 12),
              Tint(color: C.slate50, padding: const EdgeInsets.all(12), radius: 16, child: Text('From the expert: ${due!['note']}', style: t(14, c: C.slate700, h: 1.4))),
            ],
          ]),
        ),
        if (!unpaidStart)
          InkWell(
            onTap: () {
              setState(() => open = !open);
              if (open && thread == null) loadThread();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              decoration: const BoxDecoration(border: Border(top: BorderSide(color: C.slate100))),
              child: Row(children: [
                const Icon(LucideIcons.messageSquare, size: 16, color: C.slate600),
                const SizedBox(width: 8),
                Expanded(child: Text('Messages with the expert', style: t(14.5, w: w7, c: C.slate600))),
                AnimatedRotation(turns: open ? 0.5 : 0, duration: const Duration(milliseconds: 200), child: const Icon(LucideIcons.chevronDown, size: 16, color: C.slate500)),
              ]),
            ),
          ),
        if (open && !unpaidStart)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(color: Color(0x99F8FAFC), border: Border(top: BorderSide(color: C.slate100)), borderRadius: BorderRadius.vertical(bottom: Radius.circular(24))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (thread == null) Text('Loading…', style: t(14, c: C.slate400)),
              if (thread?.isEmpty == true) Text('No messages yet. The expert will write here, and you can reply.', style: t(14, c: C.slate500)),
              for (final m in thread ?? <Json>[]) _Message(m: m),
              if (!closed) ...[
                const SizedBox(height: 6),
                Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Expanded(child: TextField(controller: text, minLines: 1, maxLines: 4, maxLength: 2000, decoration: const InputDecoration(hintText: 'Write to the expert…', counterText: ''))),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    style: IconButton.styleFrom(backgroundColor: C.violet600, disabledBackgroundColor: C.violet200, fixedSize: const Size(50, 50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                    onPressed: busy || text.text.trim().isEmpty ? null : () => act('reply', {'text': text.text}),
                    icon: busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(LucideIcons.send, size: 18, color: Colors.white),
                  ),
                ]),
              ],
            ]),
          ),
        if (error.isNotEmpty) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), child: Notice(error)),
      ]),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.m});
  final Json m;
  @override
  Widget build(BuildContext context) {
    final mine = m['from'] == 'you';
    final charge = m['charge'] == null ? null : asMap(m['charge']);
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.72),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(color: mine ? C.violet600 : Colors.white, borderRadius: BorderRadius.circular(18), border: mine ? null : Border.all(color: C.slate100)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            charge != null
                ? Text.rich(TextSpan(style: t(14.5, c: mine ? Colors.white : C.slate700, h: 1.4), children: [
                    TextSpan(text: '${charge['kind'] == 'quote' ? 'Quote' : 'Top-up'}: ', style: const TextStyle(fontWeight: w7)),
                    TextSpan(text: '${rupees(charge['total'])} incl. GST${charge['note'] != null ? '. ${charge['note']}' : ''}'),
                  ]))
                : Text(m['text'] ?? '', style: t(14.5, c: mine ? Colors.white : C.slate700, h: 1.4)),
            const SizedBox(height: 4),
            Text('${mine ? 'You' : m['name'] ?? 'Expert'} · ${when(m['at'])}', style: t(11, c: mine ? Colors.white.withValues(alpha: 0.7) : C.slate400)),
          ]),
        ),
      ),
    );
  }
}

/// Pay what's due on an order: the purchase, a quote or a top-up.
class ServiceCheckoutScreen extends StatefulWidget {
  const ServiceCheckoutScreen({super.key, required this.id});
  final String id;
  @override
  State<ServiceCheckoutScreen> createState() => _ServiceCheckoutScreenState();
}

class _ServiceCheckoutScreenState extends State<ServiceCheckoutScreen> {
  Json? data;
  String error = '';
  Json? paid;

  @override
  void initState() {
    super.initState();
    api.get('/api/orders/${widget.id}').then((d) => mounted ? setState(() => data = asMap(d)) : null).catchError((e) => mounted ? setState(() => error = e.toString()) : null);
  }

  @override
  Widget build(BuildContext context) {
    final o = asMap(data?['order']);
    final due = o['due'] == null ? null : asMap(o['due']);
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout'), backgroundColor: const Color(0xFFFAF9FF)),
      body: PageList(children: spaced([
        if (error.isNotEmpty) Notice(error),
        if (data == null && error.isEmpty) const LoadingBlocks(count: 2),
        if (data != null && paid != null)
          PaidCard(
            reference: paid!['reference'],
            extra: ' · Order ${o['ref']}',
            text: 'Our expert has your request and will contact you, usually within one working day. You can message them from Experts.',
            button: 'Go to my expert services',
            onDone: () => context.go('/experts'),
          )
        else if (data != null && due == null)
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Nothing to pay on ${o['ref']}', style: t(18, w: w8, c: C.slate900)),
              const SizedBox(height: 8),
              TextButton(onPressed: () => context.go('/experts'), child: Text('My expert services →', style: t(15, w: w7, c: C.violet600))),
            ]),
          )
        else if (data != null) ...[
          PageHeader(
            emoji: '🧾',
            title: 'Checkout',
            subtitle: due!['kind'] == 'quote' ? 'Pay the expert’s quote to start the work.' : due['kind'] == 'topup' ? 'Pay the top-up for the additional work.' : 'Pay for your expert service.',
          ),
          OrderSummary(
            title: o['serviceName'] ?? '',
            subtitle: 'Order ${o['ref']}',
            items: asList(due['items']),
            total: due['total'],
            note: due['note'] as String?,
            footnote: 'A professional fee to MyFoodLicense. Government fees, if any, are paid separately.',
            footIcon: LucideIcons.receipt,
          ),
          data!['paymentMode'] == 'test'
              ? PayPanel(
                  label: 'Pay ${rupees(due['total'])}',
                  onPay: (method, outcome) async {
                    final r = asMap(await api.post('/api/orders/${o['id']}/pay', {'method': method, 'outcome': outcome}));
                    final p = asMap(r['payment']);
                    if (p['status'] == 'paid') setState(() => paid = p);
                    return p;
                  },
                )
              : GatewayPanel(mode: data!['paymentMode'] as String, label: 'Pay ${rupees(due['total'])}', start: {'orderId': o['id']}),
        ],
      ])),
    );
  }
}
