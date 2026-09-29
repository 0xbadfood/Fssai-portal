import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/config.dart';
import '../core/session.dart';
import '../core/store.dart';
import '../theme.dart';
import '../widgets/ui.dart';
import 'auth/auth_screens.dart';
import 'shell.dart';

/// The rest of the web's sidebar: premises, payments, support, and the account.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    Widget item(IconData icon, String title, String note, VoidCallback onTap, {Color bg = C.violet50, Color fg = C.violet600}) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: AppCard(
            padding: const EdgeInsets.all(16),
            onTap: onTap,
            child: Row(children: [
              IconBadge(icon, bg: bg, fg: fg),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: t(16.5, w: w8, c: C.slate900)), Text(note, style: t(13.5, c: C.slate500, h: 1.35))])),
              const Icon(LucideIcons.chevronRight, size: 18, color: C.slate300),
            ]),
          ),
        );

    return PageList(children: [
      const PageHeader(title: 'More'),
      const SizedBox(height: 16),
      item(LucideIcons.mapPin, 'Premises', 'Where you make, store, serve or sell food', () => context.push('/premises'), bg: C.pink50, fg: C.pink500),
      item(LucideIcons.creditCard, 'Payments', 'The government fee and your receipts', () => context.push('/payments'), bg: C.emerald50, fg: C.emerald600),
      item(LucideIcons.lifeBuoy, 'Support', 'Talk to an expert, quick answers', () => context.push('/support'), bg: C.sky50, fg: C.sky600),
      item(LucideIcons.sparkles, 'Browse expert services', '127 services from a food regulatory expert', () => context.push('/catalogue'), bg: C.orange50, fg: C.orange600),
      const SizedBox(height: 10),
      GestureDetector(
        onTap: () => context.push('/catalogue'),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(gradient: G.brand, borderRadius: BorderRadius.circular(24), boxShadow: [BoxShadow(color: C.violet200.withValues(alpha: 0.8), blurRadius: 18, offset: const Offset(0, 8))]),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(LucideIcons.userCheck, size: 24, color: Colors.white),
            const SizedBox(height: 10),
            Text('Stuck with FSSAI?', style: t(18, w: w8, c: Colors.white)),
            const SizedBox(height: 4),
            Text('Labels, notices, rejections: our experts can help.', style: t(14, c: Colors.white.withValues(alpha: 0.85))),
            const SizedBox(height: 10),
            Row(children: [Text('Talk to an expert', style: t(14, w: w7, c: Colors.white)), const SizedBox(width: 4), const Icon(LucideIcons.arrowRight, size: 15, color: Colors.white)]),
          ]),
        ),
      ),
      const SizedBox(height: 20),
      AppCard(
        padding: const EdgeInsets.all(16),
        onTap: () => showAccountSheet(context),
        child: Row(children: [
          Container(width: 44, height: 44, alignment: Alignment.center, decoration: const BoxDecoration(shape: BoxShape.circle, gradient: G.violet), child: Text(session.initials, style: t(15, w: w7, c: Colors.white))),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(session.name, style: t(16, w: w8, c: C.slate900)), Text(session.user?['email'] ?? '', style: t(13.5, c: C.slate500))])),
          const Icon(LucideIcons.logOut, size: 18, color: C.slate400),
        ]),
      ),
      const SizedBox(height: 10),
      TextButton.icon(
        onPressed: () => launchUrl(Uri.parse('https://$brandDomain'), mode: LaunchMode.externalApplication),
        icon: const Icon(LucideIcons.globe, size: 16, color: C.slate500),
        label: Text('Open $brandDomain', style: t(14, w: w6, c: C.slate500)),
      ),
      const SizedBox(height: 8),
      const Disclaimer(),
    ]);
  }
}

class PremisesScreen extends StatefulWidget {
  const PremisesScreen({super.key});
  @override
  State<PremisesScreen> createState() => _PremisesScreenState();
}

class _PremisesScreenState extends State<PremisesScreen> {
  @override
  void initState() {
    super.initState();
    store.loadCurrent();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Premises'), backgroundColor: const Color(0xFFFAF9FF)),
      body: ListenableBuilder(
        listenable: store,
        builder: (context, _) {
          if (!store.appLoaded) return const PageList(children: [LoadingBlocks(count: 2)]);
          final app = store.app;
          final info = asMap(app?['info']);
          String? row(String id) => asList(store.intake['summary']).where((x) => x['id'] == id).map((x) => x['value'] as String?).firstOrNull;
          final place = row('place');
          final result = asMap(store.plan['result']);
          final address = [info['premises_address'], info['city'], info['pincode'], info['state'] ?? row('state')].where((x) => x != null && x.toString().isNotEmpty).join(', ');
          // The result lists an "another premises" task when the business has more than one place.
          final several = asList(result['tasks']).any((t) => t['task'] == 'another_premises');

          return PageList(
            onRefresh: store.loadCurrent,
            children: spaced([
              const PageHeader(emoji: '📍', title: 'Premises', subtitle: 'Every place where you make, store, serve or sell food needs its own FSSAI registration or licence.'),
              if (place == null)
                AppCard(
                  padding: const EdgeInsets.all(24),
                  child: Column(children: [
                    const Text('🏪', style: TextStyle(fontSize: 40)),
                    const SizedBox(height: 10),
                    Text('No premises yet', style: t(20, w: w8, c: C.slate900)),
                    const SizedBox(height: 4),
                    Text('Your premises are added while you answer a few questions about your business.', textAlign: TextAlign.center, style: t(15, c: C.slate500, h: 1.4)),
                    const SizedBox(height: 18),
                    BigButton(label: 'Start my application', trailingIcon: LucideIcons.arrowRight, expand: false, onPressed: () => context.go('/apply')),
                  ]),
                )
              else ...[
                AppCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const IconBadge(LucideIcons.mapPin, size: 48, fg: Colors.white, gradient: G.violet),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(place, style: t(13.5, w: w6, c: C.slate500)),
                          Text(info['legal_name'] ?? 'Your business', style: t(18, w: w8, c: C.slate900)),
                          const SizedBox(height: 4),
                          Text(address.isEmpty ? 'Address not added yet' : address, style: t(15, c: C.slate600, h: 1.4)),
                        ]),
                      ),
                    ]),
                    const SizedBox(height: 14),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      if (result['licence'] != null) Tag(result['licence'], bg: C.violet50, fg: C.violet700),
                      store.ready ? const Tag('With our team for filing', bg: C.emerald50, fg: C.emerald700) : const Tag('Application in progress', bg: C.amber50, fg: C.amber700),
                    ]),
                    if (info['premises_address'] == null) ...[
                      const SizedBox(height: 12),
                      GestureDetector(
                        onTap: () => context.go('/apply'),
                        child: Row(children: [Text('Add the address in your application', style: t(14, w: w7, c: C.violet600)), const SizedBox(width: 4), const Icon(LucideIcons.arrowRight, size: 14, color: C.violet600)]),
                      ),
                    ],
                  ]),
                ),
                Material(
                  color: const Color(0x66F5F3FF),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24), side: const BorderSide(color: C.violet200, width: 2)),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(24),
                    onTap: () => context.push('/support?topic=premises'),
                    child: Padding(
                      padding: const EdgeInsets.all(22),
                      child: Column(children: [
                        const IconBadge(LucideIcons.plus, bg: Colors.white),
                        const SizedBox(height: 10),
                        Text('Another place of business?', style: t(17, w: w8, c: C.slate900)),
                        const SizedBox(height: 4),
                        Text(
                          several
                              ? 'You told us: ${(row('locations') ?? 'more than one place').toLowerCase()}. Our team will set up an application for each one.'
                              : 'Tell us about it and our team will set up its application.',
                          textAlign: TextAlign.center,
                          style: t(14, c: C.slate500, h: 1.4),
                        ),
                      ]),
                    ),
                  ),
                ),
              ],
            ]),
          );
        },
      ),
    );
  }
}
