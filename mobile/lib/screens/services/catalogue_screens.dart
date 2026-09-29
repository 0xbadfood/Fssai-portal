import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/session.dart';
import '../../core/store.dart';
import '../../router.dart';
import '../../theme.dart';
import '../../widgets/ui.dart';

// Expert-services catalogue: loaded once from /api/services (the server owns the prices).
Future<Json>? _catalogue;
Future<Json> catalogue() => _catalogue ??= api.get('/api/services').then(asMap).catchError((e) {
      _catalogue = null;
      throw e;
    });

typedef Tone3 = ({Color from, Color to, Color soft, Color ink, Color ring});
const Map<String, Tone3> tones = {
  'emerald': (from: Color(0xFF10B981), to: Color(0xFF0F766E), soft: Color(0xFFECFDF5), ink: Color(0xFF047857), ring: Color(0xFFA7F3D0)),
  'violet': (from: Color(0xFF8B5CF6), to: Color(0xFF6D28D9), soft: Color(0xFFF5F3FF), ink: Color(0xFF6D28D9), ring: Color(0xFFDDD6FE)),
  'orange': (from: Color(0xFFFB923C), to: Color(0xFFDB2777), soft: Color(0xFFFFF7ED), ink: Color(0xFFC2410C), ring: Color(0xFFFED7AA)),
  'sky': (from: Color(0xFF38BDF8), to: Color(0xFF4F46E5), soft: Color(0xFFF0F9FF), ink: Color(0xFF0369A1), ring: Color(0xFFBAE6FD)),
  'rose': (from: Color(0xFFFB7185), to: Color(0xFFBE123C), soft: Color(0xFFFFF1F2), ink: Color(0xFFBE123C), ring: Color(0xFFFECDD3)),
  'amber': (from: Color(0xFFFBBF24), to: Color(0xFFD97706), soft: Color(0xFFFFFBEB), ink: Color(0xFFB45309), ring: Color(0xFFFDE68A)),
};
Tone3 toneOf(dynamic name) => tones[name] ?? tones['violet']!;

const headIcons = {
  'licensing-approvals': LucideIcons.badgeCheck,
  'product': LucideIcons.flaskConical,
  'labels-claims': LucideIcons.tags,
  'specialty-imports': LucideIcons.ship,
  'compliance': LucideIcons.shieldCheck,
  'advisory': LucideIcons.messagesSquare,
};

String? unitOf(Json price) => price['unit'] as String? ?? (price['type'] == 'monthly' ? 'month' : null);

/// "₹5,000 onwards", "₹5,000–7,500 per SKU", "₹15,000 a month", "Custom quote".
String priceLabel(Json price, {bool short = false}) {
  final unit = unitOf(price);
  final per = unit != null && price['type'] != 'monthly' ? ' per $unit' : '';
  return switch (price['type']) {
    'quote' => 'Custom quote',
    'monthly' => '${rupees(price['amount'])} a month',
    'range' => short ? 'from ${rupees(price['amount'])}$per' : '${rupees(price['amount'])}–${grouped(price['max'] as num)}$per',
    'from' => '${rupees(price['amount'])} onwards$per',
    _ => '${rupees(price['amount'])}$per',
  };
}

/// The service with its section and heading.
({Json svc, Json section, Json? head})? findService(Json cat, String id) {
  for (final section in asList(cat['sections'])) {
    for (final svc in asList(section['services'])) {
      if (svc['id'] == id) {
        final head = asList(cat['heads']).where((h) => asStrings(h['sections']).contains(section['id'])).firstOrNull;
        return (svc: svc, section: section, head: head);
      }
    }
  }
  return null;
}

/// Expert services: the whole catalogue, grouped under headings, each service a raised bar.
class CatalogueScreen extends StatefulWidget {
  const CatalogueScreen({super.key, this.head});
  final String? head;
  @override
  State<CatalogueScreen> createState() => _CatalogueScreenState();
}

class _CatalogueScreenState extends State<CatalogueScreen> {
  late String head = widget.head ?? 'all';
  String q = '';
  Json? cat;
  String error = '';

  @override
  void initState() {
    super.initState();
    catalogue().then((c) => mounted ? setState(() => cat = c) : null).catchError((e) => mounted ? setState(() => error = e.toString()) : null);
  }

  void update(VoidCallback f) => setState(f);

  @override
  Widget build(BuildContext context) {
    final needle = q.trim().toLowerCase();
    final heads = <(Json, List<(Json, List<Json>)>)>[];
    if (cat != null) {
      final sections = {for (final s in asList(cat!['sections'])) s['id']: s};
      for (final h in asList(cat!['heads'])) {
        if (head != 'all' && h['id'] != head) continue;
        final secs = <(Json, List<Json>)>[];
        for (final sid in asStrings(h['sections'])) {
          final s = sections[sid];
          if (s == null) continue;
          final svcs = asList(s['services']).where((x) => needle.isEmpty || '${x['name']} ${x['scope']} ${x['summary']} ${s['title']}'.toLowerCase().contains(needle)).toList();
          if (svcs.isNotEmpty) secs.add((s, svcs));
        }
        if (secs.isNotEmpty) heads.add((h, secs));
      }
    }
    final total = cat == null ? 0 : asList(cat!['sections']).fold<int>(0, (n, s) => n + asList(s['services']).length);
    final expert = asMap(cat?['expert']);

    return Scaffold(
      backgroundColor: Colors.white,
      body: CustomScrollView(slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: 0,
          backgroundColor: C.slate950,
          foregroundColor: Colors.white,
          title: Text('Expert services', style: t(18, w: w8, c: Colors.white)),
        ),
        SliverToBoxAdapter(
          child: Container(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            decoration: const BoxDecoration(
              color: C.slate950,
              gradient: RadialGradient(center: Alignment(-0.9, -1.2), radius: 1.6, colors: [Color(0x738B5CF6), C.slate950]),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Tag('EXPERT SERVICES', bg: Colors.white.withValues(alpha: 0.1), fg: C.violet200, icon: LucideIcons.userCheck, border: Colors.white.withValues(alpha: 0.15)),
              const SizedBox(height: 16),
              Text('Food regulatory expertise, from licence to launch', style: t(30, w: w8, c: Colors.white, h: 1.15, ls: -0.6)),
              const SizedBox(height: 12),
              Text(
                'Licensing, product classification, formulation, labels, claims, imports and the authority’s notices, handled by an expert who has done it for two decades.',
                style: t(15.5, c: C.slate300, h: 1.5),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(28), border: Border.all(color: Colors.white.withValues(alpha: 0.15))),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    ShaderMask(
                      shaderCallback: (r) => const LinearGradient(colors: [Colors.white, C.violet200]).createShader(r),
                      child: Text('20+', style: t(60, w: w9, c: Colors.white, h: 1)),
                    ),
                    const SizedBox(width: 12),
                    Padding(padding: const EdgeInsets.only(bottom: 6), child: Text('years in the\nfood industry', style: t(16, w: w7, c: C.slate200, h: 1.2))),
                  ]),
                  const SizedBox(height: 14),
                  Text(expert['summary'] ?? 'Our regulatory lead has spent over two decades inside the food industry.', style: t(14, c: C.slate300, h: 1.5)),
                  const SizedBox(height: 14),
                  Text('HAS WORKED WITH', style: t(11, w: w7, c: C.slate400, ls: 1.2)),
                  const SizedBox(height: 8),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    for (final c in asStrings(expert['companies']).isEmpty ? ['Unilever', 'Reliance', 'MTR Foods'] : asStrings(expert['companies']))
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.white.withValues(alpha: 0.15))),
                        child: Text(c, style: t(15, w: w8, c: Colors.white)),
                      ),
                  ]),
                  if (asList(expert['highlights']).isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Row(children: [
                      for (final h in asList(expert['highlights']))
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(h['value'] ?? '', style: t(22, w: w9, c: Colors.white)), Text(h['label'] ?? '', style: t(11.5, c: C.slate400, h: 1.3))])),
                    ]),
                  ],
                ]),
              ),
              const SizedBox(height: 18),
              BigButton(label: 'Book a 30-minute consultation', icon: LucideIcons.calendarClock, tone: Tone.white, onPressed: () => context.push('/catalogue/30-minute-consultation')),
            ]),
          ),
        ),
        SliverPersistentHeader(pinned: true, delegate: _Filters(this, total)),
        if (error.isNotEmpty) SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.all(16), child: Notice('The services could not be loaded: $error'))),
        if (cat == null && error.isEmpty) const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.all(40), child: Spinner())),
        if (cat != null && heads.isEmpty)
          SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.all(32), child: Text('No service matches “$q”. Try another word.', textAlign: TextAlign.center, style: t(15, c: C.slate500)))),
        for (final (h, secs) in heads)
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
            sliver: SliverList.list(children: [
              Row(children: [
                IconBadge(headIcons[h['id']] ?? LucideIcons.badgeCheck, size: 52, fg: Colors.white, gradient: G.of(toneOf(h['tone']).from, toneOf(h['tone']).to)),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(h['title'] ?? '', style: t(22, w: w8, c: C.slate900, ls: -0.3)), Text(h['blurb'] ?? '', style: t(14, c: C.slate500, h: 1.35))])),
              ]),
              for (final (s, svcs) in secs) ...[
                const SizedBox(height: 22),
                Text(s['title'] ?? '', style: t(17, w: w8, c: C.slate800)),
                const SizedBox(height: 2),
                Text(s['intro'] ?? '', style: t(13.5, c: C.slate500, h: 1.4)),
                const SizedBox(height: 12),
                for (final svc in svcs) Padding(padding: const EdgeInsets.only(bottom: 12), child: ServiceBar(svc: svc, tone: toneOf(h['tone']))),
              ],
            ]),
          ),
        if (cat != null)
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.only(top: 24),
              padding: const EdgeInsets.fromLTRB(16, 28, 16, 40),
              color: C.slate50,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text('GOOD TO KNOW', style: t(12.5, w: w7, c: C.violet500, ls: 1.2)),
                const SizedBox(height: 4),
                Text('How our fees work', style: t(22, w: w8, c: C.slate900)),
                const SizedBox(height: 8),
                Text('Fees are professional fees and exclude GST (18%, added at checkout). Government, laboratory and third-party costs are separate.', style: t(15, c: C.slate600, h: 1.45)),
                const SizedBox(height: 16),
                for (final term in asList(cat!['terms']))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: AppCard(
                      padding: const EdgeInsets.all(16),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(term['title'] ?? '', style: t(15.5, w: w8, c: C.slate900)), const SizedBox(height: 4), Text(term['text'] ?? '', style: t(14, c: C.slate500, h: 1.45))]),
                    ),
                  ),
                if (cat!['tentative'] == true)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text('Service descriptions are being finalised with our expert and may change. Fees are indicative and exclude GST; the final fee is confirmed after a scope check.', textAlign: TextAlign.center, style: t(12, c: C.slate400, h: 1.4)),
                  ),
              ]),
            ),
          ),
      ]),
    );
  }
}

class _Filters extends SliverPersistentHeaderDelegate {
  _Filters(this.s, this.total);
  final _CatalogueScreenState s;
  final int total;
  @override
  double get minExtent => 124;
  @override
  double get maxExtent => 124;
  @override
  bool shouldRebuild(covariant _Filters old) => true;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final heads = asList(s.cat?['heads']);
    Widget pill(String id, String label, Tone3? tone) {
      final on = s.head == id;
      final tn = tone ?? tones['violet']!;
      return Padding(
        padding: const EdgeInsets.only(right: 8),
        child: Material(
          color: on ? null : C.slate50,
          shape: StadiumBorder(side: on ? BorderSide.none : const BorderSide(color: C.slate200)),
          child: Ink(
            decoration: on ? ShapeDecoration(shape: const StadiumBorder(), gradient: G.of(tn.from, tn.to)) : null,
            child: InkWell(
              customBorder: const StadiumBorder(),
              onTap: () => s.update(() => s.head = id),
              child: Padding(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9), child: Text(label, style: t(13.5, w: w7, c: on ? Colors.white : C.slate600))),
            ),
          ),
        ),
      );
    }

    return Container(
      color: Colors.white.withValues(alpha: 0.97),
      padding: const EdgeInsets.fromLTRB(16, 10, 0, 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.only(right: 16),
          child: TextField(
            onChanged: (v) => s.update(() => s.q = v),
            style: t(15, c: C.slate900),
            decoration: InputDecoration(
              isDense: true,
              prefixIcon: const Icon(LucideIcons.search, size: 17, color: C.slate400),
              hintText: 'Search $total services: label review, nutraceutical…',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: C.slate200)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: C.slate200)),
            ),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 38,
          child: ListView(scrollDirection: Axis.horizontal, children: [
            pill('all', 'All services', null),
            for (final h in heads) pill(h['id'] as String, h['title'] as String, toneOf(h['tone'])),
            const SizedBox(width: 8),
          ]),
        ),
      ]),
    );
  }
}

/// One service as a raised bar: a coloured end cap, an extruded lower edge, the price on the right.
class ServiceBar extends StatelessWidget {
  const ServiceBar({super.key, required this.svc, required this.tone});
  final Json svc;
  final Tone3 tone;
  @override
  Widget build(BuildContext context) {
    final price = asMap(svc['price']);
    final quote = price['type'] == 'quote';
    final r = BorderRadius.circular(18);
    return Container(
      decoration: BoxDecoration(
        borderRadius: r,
        boxShadow: [
          BoxShadow(color: tone.ring, offset: const Offset(0, 2)),
          BoxShadow(color: tone.from.withValues(alpha: 0.33), offset: const Offset(0, 3)),
          BoxShadow(color: tone.to.withValues(alpha: 0.2), offset: const Offset(0, 5)),
          BoxShadow(color: tone.to.withValues(alpha: 0.35), blurRadius: 24, offset: const Offset(0, 14), spreadRadius: -14),
        ],
      ),
      child: Material(
        color: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: r, side: BorderSide(color: tone.ring)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push('/catalogue/${svc['id']}'),
          child: IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Container(width: 12, decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [tone.from, tone.to]))),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(svc['name'] ?? '', style: t(15.5, w: w8, c: C.slate900, h: 1.3)),
                    const SizedBox(height: 3),
                    Text(svc['scope'] ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: t(13, c: C.slate500, h: 1.35)),
                  ]),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(0, 12, 12, 12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisAlignment: MainAxisAlignment.center, children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: tone.soft, borderRadius: BorderRadius.circular(8)),
                    child: Text(priceLabel(price, short: true), style: t(12, w: w8, c: tone.ink)),
                  ),
                  const SizedBox(height: 6),
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    Text(quote ? 'Quote' : 'View', style: t(12, w: w7, c: tone.ink)),
                    const SizedBox(width: 2),
                    Icon(LucideIcons.arrowRight, size: 13, color: tone.ink),
                  ]),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// One expert service: what to expect, then Buy (or Request a quote).
class ServiceDetailScreen extends StatefulWidget {
  const ServiceDetailScreen({super.key, required this.id});
  final String id;
  @override
  State<ServiceDetailScreen> createState() => _ServiceDetailScreenState();
}

class _ServiceDetailScreenState extends State<ServiceDetailScreen> {
  Json? cat;
  String error = '';
  int qty = 1;
  final brief = TextEditingController();
  bool busy = false;
  String buyError = '';
  Json? sent;

  @override
  void initState() {
    super.initState();
    catalogue().then((c) => mounted ? setState(() => cat = c) : null).catchError((e) => mounted ? setState(() => error = e.toString()) : null);
  }

  Future<void> go(Json svc) async {
    final quote = asMap(svc['price'])['type'] == 'quote';
    if (!session.signedIn) {
      returnTo = '/catalogue/${svc['id']}';
      context.push('/signup');
      return;
    }
    setState(() {
      busy = true;
      buyError = '';
    });
    try {
      final order = asMap((await api.post('/api/orders', {'serviceId': svc['id'], 'quantity': qty, 'brief': brief.text}))['order']);
      if (!mounted) return;
      if (quote) {
        setState(() => sent = order);
      } else {
        context.push('/orders/${order['id']}/pay');
      }
    } on ApiException catch (e) {
      setState(() => buyError = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final found = cat == null ? null : findService(cat!, widget.id);
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(backgroundColor: found == null ? Colors.white : toneOf(found.head?['tone']).soft, title: Text(found?.head?['title'] ?? 'Expert service', style: t(16, w: w7, c: C.slate700))),
      body: cat == null
          ? (error.isEmpty ? const Spinner() : Padding(padding: const EdgeInsets.all(16), child: Notice('The service could not be loaded: $error')))
          : found == null
              ? Center(child: Text('We couldn’t find that service.', style: t(18, w: w8, c: C.slate900)))
              : _detail(found.svc, found.section, toneOf(found.head?['tone'])),
    );
  }

  Widget _detail(Json svc, Json section, Tone3 tone) {
    final price = asMap(svc['price']);
    final quote = price['type'] == 'quote';
    final unit = unitOf(price);
    final gstRate = (cat!['gstRate'] as num?) ?? 0.18;
    final fee = quote ? 0 : (price['amount'] as num) * qty;
    final gst = (fee * gstRate).round();
    final related = asList(section['services']).where((s) => s['id'] != svc['id']).take(4).toList();
    final turnaround = (svc['turnaround'] as String?) ?? '';

    Widget block(String title, IconData icon, Widget child) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [Icon(icon, size: 19, color: tone.from), const SizedBox(width: 8), Text(title, style: t(17, w: w8, c: C.slate900))]),
              const SizedBox(height: 12),
              child,
            ]),
          ),
        );

    return ListView(padding: EdgeInsets.zero, children: [
      Container(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [tone.soft, Colors.white], stops: const [0, 0.7])),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(section['title'] ?? '', style: t(13.5, w: w7, c: tone.ink)),
          const SizedBox(height: 8),
          Text(svc['name'] ?? '', style: t(27, w: w8, c: C.slate900, h: 1.2, ls: -0.4)),
          const SizedBox(height: 10),
          Text(svc['summary'] ?? '', style: t(16, c: C.slate600, h: 1.5)),
          const SizedBox(height: 14),
          Wrap(spacing: 8, runSpacing: 8, children: [
            Tag(svc['scope'] ?? '', bg: Colors.white, fg: C.slate700, icon: LucideIcons.clipboardList, border: tone.ring),
            Tag(turnaround, bg: Colors.white, fg: C.slate700, icon: LucideIcons.clock, border: tone.ring),
          ]),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          // Buy card first on a phone: the price is what people look for.
          Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: C.slate100),
              boxShadow: [BoxShadow(color: tone.to.withValues(alpha: 0.35), blurRadius: 40, offset: const Offset(0, 20), spreadRadius: -20)],
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(gradient: G.of(tone.from, tone.to)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('PROFESSIONAL FEE', style: t(11.5, w: w7, c: Colors.white.withValues(alpha: 0.8), ls: 1.2)),
                  const SizedBox(height: 4),
                  Text(priceLabel(price), style: t(28, w: w9, c: Colors.white)),
                  if (!quote) Text('+ GST ${(gstRate * 100).round()}%${price['type'] == 'from' || price['type'] == 'range' ? ' · starting fee' : ''}', style: t(14, c: Colors.white.withValues(alpha: 0.85))),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: sent != null
                    ? Notice('Quote requested ✓  Reference ${sent!['ref']}. Our expert will send you a quote; you’ll see it under Experts.', tone: 'green')
                    : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        if (unit != null && !quote) ...[
                          Row(children: [
                            Expanded(child: Text(unit == 'month' ? 'Months' : 'Number of ${unit == 'SKU' ? 'SKUs' : '${unit}s'}', style: t(14.5, w: w6, c: C.slate600))),
                            IconButton.outlined(onPressed: () => setState(() => qty = (qty - 1).clamp(1, 50)), icon: const Icon(LucideIcons.minus, size: 16)),
                            SizedBox(width: 36, child: Text('$qty', textAlign: TextAlign.center, style: t(18, w: w8, c: C.slate900))),
                            IconButton.outlined(onPressed: () => setState(() => qty = (qty + 1).clamp(1, 50)), icon: const Icon(LucideIcons.plus, size: 16)),
                          ]),
                          const SizedBox(height: 12),
                        ],
                        if (!quote) ...[
                          _line('Fee${unit != null && qty > 1 ? ' ($qty × ${rupees(price['amount'])})' : ''}', rupees(fee)),
                          _line('GST ${(gstRate * 100).round()}%', rupees(gst)),
                          const Divider(height: 18),
                          _line('You pay now', rupees(fee + gst), bold: true),
                          const SizedBox(height: 14),
                        ],
                        LabeledField(
                          label: quote ? 'What do you need? (required for a quote)' : 'Anything the expert should know? (optional)',
                          controller: brief,
                          maxLines: 3,
                          maxLength: 2000,
                          hint: quote ? 'e.g. 12 outlets in 3 states; we want to plan the licences before opening.' : 'e.g. product name, number of SKUs, deadline.',
                        ),
                        if (buyError.isNotEmpty) ...[const SizedBox(height: 12), Notice(buyError)],
                        const SizedBox(height: 14),
                        BigButton(
                            label: quote ? 'Request a quote' : 'Buy this service',
                            icon: quote ? LucideIcons.send : LucideIcons.shoppingCart,
                            busy: busy,
                            gradient: G.of(tone.from, tone.to),
                            onPressed: () => go(svc),
                          ),
                        if (!session.signedIn) ...[const SizedBox(height: 8), Text('You’ll create a free account (or sign in) first.', textAlign: TextAlign.center, style: t(12.5, c: C.slate400))],
                        if (!quote && price['type'] != 'fixed' && price['type'] != 'monthly') ...[
                          const SizedBox(height: 10),
                          Text('You pay the starting fee now. If the expert finds the work is larger, they send a top-up quote before doing it.', style: t(12.5, c: C.slate400, h: 1.4)),
                        ],
                      ]),
              ),
            ]),
          ),
          const SizedBox(height: 18),
          block('What’s included', LucideIcons.circleCheck, Column(children: [
            for (final x in asStrings(svc['includes']))
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(LucideIcons.circleCheck, size: 18, color: tone.from),
                  const SizedBox(width: 10),
                  Expanded(child: Text(x, style: t(15, c: C.slate700, h: 1.4))),
                ]),
              ),
          ])),
          block('What you get', LucideIcons.fileCheck2, Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(svc['deliverable'] ?? '', style: t(15, c: C.slate700, h: 1.45)),
            const SizedBox(height: 8),
            Row(children: [
              const Icon(LucideIcons.clock, size: 15, color: C.slate500),
              const SizedBox(width: 6),
              Expanded(child: Text('Typically ${turnaround.isEmpty ? '' : turnaround[0].toLowerCase() + turnaround.substring(1)}', style: t(14, c: C.slate500))),
            ]),
          ])),
          block('What we’ll need from you', LucideIcons.clipboardList, Bullets(asStrings(section['needs']))),
          if (section['note'] != null) Padding(padding: const EdgeInsets.only(bottom: 14), child: Notice(section['note'], tone: 'amber', icon: LucideIcons.info)),
          block('How it works', LucideIcons.shieldCheck, Column(children: [
            for (final (i, text) in [
              quote ? 'Tell us what you need; the expert sends you a quote to pay online.' : 'Pay the starting fee online (+ GST).',
              'Our expert contacts you, usually within one working day, and asks for what’s needed.',
              'The expert works on it with you; you can message them from the app.',
              'You receive the deliverable. Bigger scope than expected? You get a top-up quote first.',
            ].indexed)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(width: 26, height: 26, alignment: Alignment.center, decoration: BoxDecoration(shape: BoxShape.circle, gradient: G.of(tone.from, tone.to)), child: Text('${i + 1}', style: t(12, w: w9, c: Colors.white))),
                  const SizedBox(width: 12),
                  Expanded(child: Text(text, style: t(14.5, c: C.slate600, h: 1.4))),
                ]),
              ),
          ])),
          if (cat!['tentative'] == true)
            Text('This description is being finalised with our expert and may change. The exact scope is confirmed when the expert contacts you.', style: t(12, c: C.slate400, h: 1.4)),
          if (related.isNotEmpty) ...[
            const SizedBox(height: 22),
            Text('More in ${section['title']}', style: t(17, w: w8, c: C.slate800)),
            const SizedBox(height: 12),
            for (final r in related) Padding(padding: const EdgeInsets.only(bottom: 12), child: ServiceBar(svc: r, tone: tone)),
          ],
          const SizedBox(height: 24),
        ]),
      ),
    ]);
  }

  Widget _line(String a, String b, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Expanded(child: Text(a, style: t(bold ? 16 : 14.5, w: bold ? w8 : FontWeight.w400, c: bold ? C.slate900 : C.slate600))),
          Text(b, style: t(bold ? 16 : 14.5, w: bold ? w8 : w6, c: bold ? C.slate900 : C.slate600)),
        ]),
      );
}
