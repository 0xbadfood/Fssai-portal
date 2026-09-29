import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/store.dart';
import '../theme.dart';
import '../widgets/doc_card.dart';
import '../widgets/ui.dart';

/// Document Vault: what the current application needs first, then every other kind of document to keep for later.
class VaultScreen extends StatefulWidget {
  const VaultScreen({super.key});
  @override
  State<VaultScreen> createState() => _VaultScreenState();
}

class _VaultScreenState extends State<VaultScreen> {
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
        final r = store.plan;
        final needed = asList(r['docs']);
        final neededIds = needed.map((d) => d['id']).toSet();
        final others = (store.config?.docTypes.keys ?? const <String>[]).where((id) => !neededIds.contains(id)).toList();
        final required = needed.where((d) => d['optional'] != true).toList();
        final done = required.where((d) => isDocOk(store.docs[d['id']])).length;
        String label(String id) => store.config?.docLabel(id) ?? id;

        return PageList(
          onRefresh: store.refreshAll,
          children: spaced([
            const PageHeader(emoji: '📂', title: 'Document Vault', subtitle: "Upload once and reuse. Our AI checks every photo or PDF straight away and tells you if it's good to go."),
            const Align(alignment: Alignment.centerLeft, child: Tag('Only you and our team can see these', bg: Colors.white, fg: C.slate600, icon: LucideIcons.lock, border: C.slate100)),
            if (!store.docsLoaded || store.config == null) const LoadingBlocks(count: 2),
            if (needed.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(gradient: G.of(C.amber50, C.orange50), borderRadius: BorderRadius.circular(24), border: Border.all(color: C.amber100)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Row(children: [
                    Expanded(child: Text('Needed for your ${asMap(r['result'])['licence'] ?? 'application'}', style: t(17, w: w8, c: C.amber900))),
                    Text('$done/${required.length} ready', style: t(15, w: w8, c: C.amber900)),
                  ]),
                  const SizedBox(height: 12),
                  ProgressBar(value: required.isEmpty ? 0 : done / required.length),
                  if (!store.ready && done == required.length && required.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    GestureDetector(
                      onTap: () => context.go('/apply'),
                      child: Row(children: [Text('All in, continue your application', style: t(14, w: w7, c: C.amber900)), const SizedBox(width: 4), const Icon(LucideIcons.arrowRight, size: 14, color: C.amber900)]),
                    ),
                  ],
                ]),
              ),
              for (final d in needed)
                DocumentCard(docTypeId: d['id'] as String, label: '${label(d['id'] as String)}${d['optional'] == true ? ' (optional)' : ''}', tag: d['why'] as String?, doc: store.docs[d['id']]),
              const SizedBox(height: 4),
            ],
            if (store.config != null)
              SectionTitle(needed.isNotEmpty ? 'Other documents' : 'Your documents', note: 'Not needed for your current application, but handy to keep here for later filings.'),
            for (final id in others) DocumentCard(docTypeId: id, label: label(id), doc: store.docs[id]),
          ], 12),
        );
      },
    );
  }
}
