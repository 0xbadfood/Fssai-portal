import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/payments.dart';
import '../core/store.dart';
import '../theme.dart';
import '../widgets/ui.dart';

const _methodLabel = {'upi': 'UPI', 'card': 'Card', 'netbanking': 'Net banking', 'wallet': 'Wallet', 'paylater': 'Pay later', 'other': 'Online'};

/// Payments: pay the government fee for the application, and the receipts.
class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});
  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  Json? data;
  Json? paid;

  Future<void> load() async {
    try {
      final d = asMap(await api.get('/api/payments'));
      if (mounted) setState(() => data = d);
    } catch (_) {
      if (mounted) setState(() => data = {'payments': [], 'quote': null});
    }
  }

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  Widget build(BuildContext context) {
    final quote = data?['quote'] == null ? null : asMap(data!['quote']);
    return Scaffold(
      appBar: AppBar(title: const Text('Payments'), backgroundColor: const Color(0xFFFAF9FF)),
      body: PageList(
        onRefresh: load,
        children: spaced([
          const PageHeader(emoji: '💳', title: 'Payments', subtitle: 'Pay the government fee for your application and keep your receipts here.'),
          if (data == null) const LoadingBlocks(count: 2),
          if (paid != null)
            PaidCard(
              amount: paid!['amount'],
              reference: paid!['reference'],
              text: 'Your application is submitted. Our team will call you for the OTP to file it on FoSCoS.',
              button: 'Go to my dashboard',
              onDone: () {
                store.loadCurrent();
                context.go('/home');
              },
            )
          else if (quote?['payable'] == true) ...[
            OrderSummary(
              title: quote!['licence'] ?? '',
              subtitle: 'Form ${quote['form']} · Application ${(quote['applicationId'] as String).substring(0, 8).toUpperCase()}',
              items: asList(quote['items']),
              total: quote['total'],
              footnote: 'Paid to the government through FoSCoS when we file your application.',
              footIcon: LucideIcons.lock,
            ),
            quote['mode'] == 'test'
                ? PayPanel(
                    label: 'Pay ${rupees(quote['total'])} and submit',
                    onPay: (method, outcome) async {
                      final body = asMap(await api.post('/api/payments', {'applicationId': quote['applicationId'], 'method': method, 'outcome': outcome}));
                      final p = asMap(body['payment']);
                      if (p['status'] == 'paid') setState(() => paid = p);
                      return p;
                    },
                  )
                : GatewayPanel(mode: quote['mode'] as String, label: 'Pay ${rupees(quote['total'])} and submit', start: {'applicationId': quote['applicationId']}),
          ] else if (quote != null && quote['paid'] != true)
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text('Government fee: ${rupees(quote['total'])}', style: t(18, w: w8, c: C.slate900)),
                const SizedBox(height: 4),
                Text('You can pay once your application is complete.', style: t(15, c: C.slate500)),
                const SizedBox(height: 14),
                BigButton(label: 'Continue my application', trailingIcon: LucideIcons.arrowRight, onPressed: () => context.go('/apply')),
              ]),
            ),
          if (data != null) Receipts(payments: asList(data!['payments'])),
        ]),
      ),
    );
  }
}

class OrderSummary extends StatelessWidget {
  const OrderSummary({super.key, required this.title, required this.subtitle, required this.items, required this.total, this.note, required this.footnote, required this.footIcon});
  final String title, subtitle, footnote;
  final List<Json> items;
  final num total;
  final String? note;
  final IconData footIcon;
  @override
  Widget build(BuildContext context) => AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('ORDER SUMMARY', style: t(12.5, w: w7, c: C.violet500, ls: 0.6)),
          const SizedBox(height: 4),
          Text(title, style: t(19, w: w8, c: C.slate900)),
          Text(subtitle, style: t(13.5, c: C.slate500)),
          const SizedBox(height: 14),
          const Divider(),
          const SizedBox(height: 10),
          for (final i in items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(children: [
                Expanded(child: Text(i['label'] ?? '', style: t(15, c: C.slate700))),
                Text(rupees(i['amount']), style: t(15, w: w6, c: C.slate700)),
              ]),
            ),
          const SizedBox(height: 8),
          const Divider(),
          const SizedBox(height: 10),
          Row(children: [Expanded(child: Text('Total', style: t(18, w: w8, c: C.slate900))), Text(rupees(total), style: t(18, w: w8, c: C.slate900))]),
          if (note != null) ...[const SizedBox(height: 12), Tint(color: C.slate50, padding: const EdgeInsets.all(12), radius: 16, child: Text('From the expert: $note', style: t(14, c: C.slate700, h: 1.4)))],
          const SizedBox(height: 12),
          Row(children: [Icon(footIcon, size: 12, color: C.slate400), const SizedBox(width: 6), Expanded(child: Text(footnote, style: t(12, c: C.slate400, h: 1.4)))]),
        ]),
      );
}

/// Test mode's practice checkout (no money moves): method, details, a switch to simulate a failure.
class PayPanel extends StatefulWidget {
  const PayPanel({super.key, required this.label, required this.onPay});
  final String label;
  /// Does the payment; returns the payment ({status, ...}).
  final Future<Json> Function(String method, String outcome) onPay;
  @override
  State<PayPanel> createState() => _PayPanelState();
}

class _PayPanelState extends State<PayPanel> {
  String method = 'upi', outcome = 'success';
  bool busy = false, failed = false;
  String error = '';

  Future<void> pay() async {
    setState(() {
      busy = true;
      error = '';
      failed = false;
    });
    final started = DateTime.now();
    Json? result;
    try {
      result = await widget.onPay(method, outcome);
    } on ApiException catch (e) {
      error = e.message;
    }
    // Keep the "processing" state visible briefly, like a real gateway.
    final wait = 1400 - DateTime.now().difference(started).inMilliseconds;
    if (wait > 0) await Future.delayed(Duration(milliseconds: wait));
    if (mounted) {
      setState(() {
        busy = false;
        failed = result?['status'] == 'failed';
      });
    }
  }

  @override
  Widget build(BuildContext context) => AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Notice('Test mode. This is a practice checkout: no money moves and no real details are needed.', tone: 'amber', icon: LucideIcons.flaskConical),
          const SizedBox(height: 16),
          Text('Pay with', style: t(16, w: w8, c: C.slate900)),
          const SizedBox(height: 10),
          Row(children: [
            for (final (id, label, icon) in [('upi', 'UPI', LucideIcons.smartphone), ('card', 'Card', LucideIcons.creditCard), ('netbanking', 'Net banking', LucideIcons.building2)])
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: Material(
                    color: method == id ? C.violet50 : Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: method == id ? C.violet500 : C.slate100, width: 2)),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => setState(() => method = id),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Column(children: [Icon(icon, size: 20, color: method == id ? C.violet800 : C.slate600), const SizedBox(height: 4), Text(label, style: t(13, w: w7, c: method == id ? C.violet800 : C.slate600))]),
                      ),
                    ),
                  ),
                ),
              ),
          ]),
          const SizedBox(height: 14),
          if (method == 'upi') const TextField(decoration: InputDecoration(hintText: 'yourname@upi')),
          if (method == 'card') TextField(controller: TextEditingController(text: '4111 1111 1111 1111'), style: const TextStyle(fontFamily: 'monospace')),
          if (method == 'netbanking') const TextField(decoration: InputDecoration(hintText: 'State Bank of India')),
          const SizedBox(height: 14),
          Wrap(spacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
            Text('Simulate:', style: t(14, w: w6, c: C.slate500)),
            for (final (id, label) in [('success', 'Payment succeeds'), ('fail', 'Payment fails')])
              ChoiceChip(
                label: Text(label, style: t(13, w: w7, c: outcome == id ? Colors.white : C.slate600)),
                selected: outcome == id,
                showCheckmark: false,
                selectedColor: C.slate800,
                backgroundColor: C.slate100,
                side: BorderSide.none,
                shape: const StadiumBorder(),
                onSelected: (_) => setState(() => outcome = id),
              ),
          ]),
          if (failed) ...[const SizedBox(height: 14), const Notice('The payment was declined. Nothing was charged; try again or use another method.', icon: LucideIcons.circleX)],
          if (error.isNotEmpty) ...[const SizedBox(height: 14), Notice(error)],
          const SizedBox(height: 18),
          BigButton(label: busy ? 'Processing…' : widget.label, busy: busy, onPressed: pay),
        ]),
      );
}

/// Pay through Cashfree: the server creates the payment for [start] ({applicationId} or {orderId}), Cashfree's
/// checkout opens, and the result screen confirms with the server.
class GatewayPanel extends StatefulWidget {
  const GatewayPanel({super.key, required this.mode, required this.label, required this.start});
  final String mode;
  final String label;
  final Json start;
  @override
  State<GatewayPanel> createState() => _GatewayPanelState();
}

class _GatewayPanelState extends State<GatewayPanel> {
  bool busy = false;
  String error = '';

  Future<void> pay() async {
    setState(() {
      busy = true;
      error = '';
    });
    try {
      final order = await payWithGateway(widget.start);
      if (mounted) context.pushReplacement('/payment-result?order=$order');
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } catch (e) {
      if (mounted) setState(() => error = 'The payment could not be started.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (widget.mode == 'sandbox') ...[
            const Notice("Sandbox. Cashfree's test gateway: use its test cards or UPI IDs. No money moves.", tone: 'amber', icon: LucideIcons.flaskConical),
            const SizedBox(height: 16),
          ],
          Text('Pay securely with Cashfree', style: t(16, w: w8, c: C.slate900)),
          const SizedBox(height: 4),
          Text("Cashfree's payment page opens here, then you come straight back.", style: t(14.5, c: C.slate500, h: 1.4)),
          const SizedBox(height: 14),
          Row(children: [
            for (final (icon, label) in [(LucideIcons.smartphone, 'UPI'), (LucideIcons.creditCard, 'Cards'), (LucideIcons.building2, 'Net banking'), (LucideIcons.wallet, 'Wallets')])
              Expanded(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: C.slate100, width: 2)),
                  child: Column(children: [Icon(icon, size: 19, color: C.slate600), const SizedBox(height: 4), Text(label, textAlign: TextAlign.center, style: t(11.5, w: w7, c: C.slate600))]),
                ),
              ),
          ]),
          if (error.isNotEmpty) ...[const SizedBox(height: 14), Notice(error)],
          const SizedBox(height: 18),
          BigButton(label: busy ? 'Opening the payment page…' : widget.label, busy: busy, onPressed: pay),
          const SizedBox(height: 10),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(LucideIcons.shieldCheck, size: 12, color: C.slate400),
            const SizedBox(width: 6),
            Flexible(child: Text('Your card and bank details go to Cashfree only; we never see them.', style: t(12, c: C.slate400))),
          ]),
        ]),
      );
}

class PaidCard extends StatelessWidget {
  const PaidCard({super.key, this.amount, this.reference, this.extra, required this.text, required this.button, required this.onDone});
  final num? amount;
  final String? reference;
  final String? extra;
  final String text;
  final String button;
  final VoidCallback onDone;
  @override
  Widget build(BuildContext context) => GradientHero(
        gradient: G.success,
        shadow: C.emerald100,
        radius: 32,
        padding: const EdgeInsets.all(24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(LucideIcons.circleCheckBig, size: 46, color: Colors.white),
          const SizedBox(height: 10),
          Text('Payment successful 🎉', style: t(26, w: w8, c: Colors.white)),
          const SizedBox(height: 6),
          Text.rich(TextSpan(style: t(16, c: Colors.white.withValues(alpha: 0.9)), children: [
            if (amount != null) TextSpan(text: '${rupees(amount)} paid'),
            if (reference != null) ...[
              TextSpan(text: amount != null ? ' · Reference ' : 'Reference '),
              TextSpan(text: reference, style: const TextStyle(fontWeight: w7, fontFamily: 'monospace')),
            ],
            if (extra != null) TextSpan(text: extra),
          ])),
          const SizedBox(height: 6),
          Text(text, style: t(15, c: Colors.white.withValues(alpha: 0.85), h: 1.45)),
          const SizedBox(height: 18),
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: onDone,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(button, style: t(16, w: w7, c: C.emerald700)),
                  const SizedBox(width: 8),
                  const Icon(LucideIcons.arrowRight, size: 18, color: C.emerald700),
                ]),
              ),
            ),
          ),
        ]),
      );
}

/// After Cashfree's checkout: the server asks Cashfree how it went (the webhook may already have recorded it);
/// while the bank is still deciding, check a few times.
class PaymentResultScreen extends StatefulWidget {
  const PaymentResultScreen({super.key, required this.order});
  final String order;
  @override
  State<PaymentResultScreen> createState() => _PaymentResultScreenState();
}

class _PaymentResultScreenState extends State<PaymentResultScreen> {
  Json? checkout;
  String error = '';
  bool waiting = true;
  bool stopped = false;

  @override
  void initState() {
    super.initState();
    check(6);
  }

  @override
  void dispose() {
    stopped = true;
    super.dispose();
  }

  Future<void> check(int tries) async {
    try {
      final c = asMap((await api.post('/api/payments/confirm', {'id': widget.order}))['checkout']);
      final settled = c['status'] != 'created' || c['attempt'] == 'failed' || c['attempt'] == 'dropped';
      if (stopped) return;
      setState(() {
        checkout = c;
        error = '';
        waiting = !settled && tries > 0;
      });
      if (!settled && tries > 0) {
        await Future.delayed(const Duration(milliseconds: 2500));
        if (!stopped) await check(tries - 1);
      }
      if (c['status'] == 'paid') {
        store.loadCurrent();
      }
    } on ApiException catch (e) {
      if (!stopped) {
        setState(() {
          error = e.message;
          waiting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = checkout;
    final service = asMap(c?['for'])['kind'] == 'service';
    final retry = service ? '/orders/${asMap(c?['for'])['id']}/pay' : '/payments';
    final pending = c != null && c['status'] == 'created' && !['failed', 'dropped'].contains(c['attempt']);

    return Scaffold(
      appBar: AppBar(title: const Text('Payment'), backgroundColor: const Color(0xFFFAF9FF)),
      body: PageList(children: [
        if (error.isNotEmpty) Notice(error),
        if (c == null && error.isEmpty) const LoadingBlocks(count: 1),
        if (c != null && c['status'] == 'paid')
          PaidCard(
            amount: c['amount'],
            reference: c['reference']?.toString(),
            text: service
                ? 'Our expert has your request and will contact you, usually within one working day. You can message them from Experts.'
                : 'Your application is submitted. Our team will call you for the OTP to file it on FoSCoS.',
            button: service ? 'Go to my expert services' : 'Go to my dashboard',
            onDone: () => context.go(service ? '/experts' : '/home'),
          )
        else if (c != null)
          AppCard(
            padding: const EdgeInsets.all(22),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (pending) ...[
                const Icon(LucideIcons.clock, size: 36, color: C.amber500),
                const SizedBox(height: 10),
                Text(waiting ? 'Checking your payment…' : 'Waiting for your bank', style: t(23, w: w8, c: C.slate900)),
                const SizedBox(height: 6),
                Text(
                  waiting
                      ? 'This takes a few seconds.'
                      : "We haven't heard back from your bank yet. If money left your account, it will show here as paid within a few minutes, so don't pay again. If you left the payment page without paying, you can try again: you won't be charged twice.",
                  style: t(15, c: C.slate600, h: 1.45),
                ),
                if (!waiting) ...[
                  const SizedBox(height: 18),
                  BigButton(label: 'Check again', onPressed: () {
                    setState(() => waiting = true);
                    check(3);
                  }),
                  const SizedBox(height: 10),
                  BigButton(label: 'Try again', tone: Tone.white, onPressed: () => context.pushReplacement(retry)),
                ],
              ] else ...[
                const Icon(LucideIcons.circleX, size: 36, color: C.red500),
                const SizedBox(height: 10),
                Text(
                  c['status'] == 'expired' ? 'This payment timed out' : c['attempt'] == 'dropped' ? 'Payment not completed' : "The payment didn't go through",
                  style: t(23, w: w8, c: C.slate900),
                ),
                const SizedBox(height: 6),
                Text('Nothing was charged${c['message'] != null ? ' (${c['message']})' : ''}. You can try again, with the same or another method.', style: t(15, c: C.slate600, h: 1.45)),
                const SizedBox(height: 18),
                BigButton(label: 'Try again', trailingIcon: LucideIcons.arrowRight, onPressed: () => context.pushReplacement(retry)),
              ],
            ]),
          ),
      ]),
    );
  }
}

class Receipts extends StatelessWidget {
  const Receipts({super.key, required this.payments});
  final List<Json> payments;
  @override
  Widget build(BuildContext context) => AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const SectionTitle('Receipts', icon: LucideIcons.receipt),
          const SizedBox(height: 8),
          if (payments.isEmpty) Text('No payments yet.', style: t(15, c: C.slate500)),
          for (final (i, p) in payments.indexed)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(border: i == 0 ? null : const Border(top: BorderSide(color: C.slate100))),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(asList(p['items']).firstOrNull?['label'] ?? 'Payment', style: t(15, w: w7, c: C.slate800)),
                    const SizedBox(height: 2),
                    Text('${when(p['createdAt'])} · ${_methodLabel[p['method']] ?? 'Online'}', style: t(12.5, c: C.slate500)),
                    Row(children: [
                      Flexible(child: Text('${p['reference'] ?? ''}', style: t(12, c: C.slate500).copyWith(fontFamily: 'monospace'))),
                      if (p['mode'] != 'live') ...[const SizedBox(width: 6), Tag(p['mode'] == 'sandbox' ? 'SANDBOX' : 'TEST', bg: C.amber50, fg: C.amber700)],
                    ]),
                  ]),
                ),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(rupees(p['amount']), style: t(17, w: w8, c: C.slate900)),
                  const SizedBox(height: 4),
                  p['status'] == 'paid' ? const Tag('Paid', bg: C.emerald50, fg: C.emerald700) : const Tag('Failed', bg: C.red50, fg: C.red700),
                ]),
              ]),
            ),
        ]),
      );
}
