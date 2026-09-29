import 'dart:async';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:pdfrx/pdfrx.dart';

import '../core/api.dart';
import '../core/doc_prep.dart';
import '../core/format.dart';
import '../core/store.dart';
import '../theme.dart';
import 'ui.dart';

// ---------------------------------------------------------------------------------------------------------------
// Picking a document: camera, photo library or a file (PDF), then prepared for the check. PDFs with a password
// ask for it (it is used on the phone to open the PDF and never sent).

typedef Picked = ({PreparedDoc doc, String name, int size});

Future<Picked?> pickDocument(BuildContext context) async {
  final source = await showModalBottomSheet<String>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    builder: (c) => SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Add the document', style: t(19, w: w8, c: C.slate900)),
          const SizedBox(height: 4),
          Text('A clear photo, or the PDF if you have one (e-Aadhaar, bills).', style: t(14, c: C.slate500)),
          const SizedBox(height: 14),
          _SourceTile(icon: LucideIcons.camera, label: 'Take a photo', note: 'Lay it flat, in good light', onTap: () => Navigator.pop(c, 'camera')),
          _SourceTile(icon: LucideIcons.image, label: 'Choose a photo', note: 'From your gallery', onTap: () => Navigator.pop(c, 'gallery')),
          _SourceTile(icon: LucideIcons.fileText, label: 'Choose a PDF or file', note: 'PDF, JPG, PNG or WebP', onTap: () => Navigator.pop(c, 'file')),
        ]),
      ),
    ),
  );
  if (source == null) return null;

  String name;
  Uint8List bytes;
  if (source == 'file') {
    final f = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: acceptedExtensions);
    if (f == null) return null;
    name = f.name;
    bytes = await f.readAsBytes();
  } else {
    // Resized on the phone first (a 50 MP photo is far more than the check needs); prepareFile makes the JPEG.
    final x = await ImagePicker().pickImage(source: source == 'camera' ? ImageSource.camera : ImageSource.gallery, maxWidth: 2400, maxHeight: 2400, imageQuality: 92);
    if (x == null) return null;
    name = x.name;
    bytes = await x.readAsBytes();
  }

  String? password;
  while (true) {
    try {
      final doc = await prepareFile(name, bytes, password: password);
      return (doc: doc, name: name, size: bytes.length);
    } on PdfPasswordNeeded catch (e) {
      if (!context.mounted) return null;
      password = await _askPassword(context, e.incorrect);
      if (password == null) return null;
    }
  }
}

class _SourceTile extends StatelessWidget {
  const _SourceTile({required this.icon, required this.label, required this.note, required this.onTap});
  final IconData icon;
  final String label;
  final String note;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: AppCard(
          padding: const EdgeInsets.all(14),
          onTap: onTap,
          child: Row(children: [
            IconBadge(icon),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: t(16, w: w7, c: C.slate900)), Text(note, style: t(13, c: C.slate500))])),
            const Icon(LucideIcons.chevronRight, size: 18, color: C.slate300),
          ]),
        ),
      );
}

Future<String?> _askPassword(BuildContext context, bool incorrect) {
  final ctl = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (c) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: Row(children: [
        const Icon(LucideIcons.lock, size: 18, color: C.amber700),
        const SizedBox(width: 8),
        Expanded(child: Text(incorrect ? 'That password did not work' : 'This PDF is password-protected', style: t(17, w: w8, c: C.slate900))),
      ]),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('For e-Aadhaar it is the first 4 letters of your name in CAPITALS followed by your year of birth, e.g. RAVI1990.', style: t(14, c: C.amber900, h: 1.4)),
        const SizedBox(height: 12),
        TextField(controller: ctl, autofocus: true, obscureText: true, decoration: const InputDecoration(hintText: 'PDF password'), onSubmitted: (v) => Navigator.pop(c, v.isEmpty ? null : v)),
        const SizedBox(height: 8),
        Text('Used on your phone to open the PDF. It is never sent or stored.', style: t(12.5, c: C.slate500)),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c), child: Text('Cancel', style: t(15, w: w7, c: C.slate600))),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: C.amber600, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
          onPressed: () => Navigator.pop(c, ctl.text.isEmpty ? null : ctl.text),
          child: Text('Unlock', style: t(15, w: w7, c: Colors.white)),
        ),
      ],
    ),
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Stored images (document previews), fetched with the session and kept for the app's lifetime.

final _previews = <String, Future<Uint8List>>{};

Future<Uint8List> fetchImage(String path) => _previews.putIfAbsent(path, () async {
      try {
        return (await api.bytes(path)).bytes;
      } catch (e) {
        _previews.remove(path);
        rethrow;
      }
    });

class NetImage extends StatelessWidget {
  const NetImage(this.path, {super.key, this.fit = BoxFit.contain});
  final String path;
  final BoxFit fit;
  @override
  Widget build(BuildContext context) => FutureBuilder<Uint8List>(
        future: fetchImage(path),
        builder: (_, s) => s.hasData
            ? Image.memory(s.data!, fit: fit, gaplessPlayback: true)
            : s.hasError
                ? const Center(child: Icon(LucideIcons.imageOff, color: C.slate500))
                : const Spinner(size: 18, color: C.slate500),
      );
}

/// The stored file itself: a PDF in the viewer, an image zoomable.
class FileViewerScreen extends StatelessWidget {
  const FileViewerScreen({super.key, required this.path, required this.title});
  final String path;
  final String title;

  static void open(BuildContext context, String path, String title) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => FileViewerScreen(path: path, title: title)));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.slate900,
      appBar: AppBar(backgroundColor: C.slate900, foregroundColor: Colors.white, title: Text(title, style: t(16, w: w7, c: Colors.white))),
      body: FutureBuilder(
        future: api.bytes(path),
        builder: (_, s) {
          if (s.hasError) return Center(child: Text(s.error.toString(), style: t(15, c: Colors.white)));
          if (!s.hasData) return const Spinner(color: Colors.white);
          final f = s.data!;
          if (f.mime == 'application/pdf') return PdfViewer.data(f.bytes, sourceName: path);
          return InteractiveViewer(maxScale: 6, child: Center(child: Image.memory(f.bytes)));
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The customer's document card: take or upload, watch the AI check it, see the result and what it read.

class DocumentCard extends StatefulWidget {
  const DocumentCard({super.key, required this.docTypeId, required this.label, this.tag, this.doc});
  final String docTypeId;
  final String label;
  final String? tag;
  final Json? doc;

  @override
  State<DocumentCard> createState() => _DocumentCardState();
}

typedef _Style = ({Color border, Color bg, Color badgeBg, Color badgeFg, String label, IconData icon});

const Map<String, _Style> _resultStyle = {
  'accepted': (border: Color(0xFFBBF7D0), bg: Color(0x66F0FDF4), badgeBg: Color(0xFFDCFCE7), badgeFg: Color(0xFF15803D), label: 'Verified', icon: LucideIcons.circleCheck),
  'review': (border: C.amber200, bg: Color(0x66FFFBEB), badgeBg: C.amber100, badgeFg: C.amber700, label: 'Accepted, needs officer review', icon: LucideIcons.triangleAlert),
  'rejected': (border: C.red200, bg: Color(0x66FEF2F2), badgeBg: C.red100, badgeFg: C.red700, label: 'Not acceptable', icon: LucideIcons.circleX),
  // Our team's review overrides the AI check either way.
  'approved': (border: Color(0xFFBBF7D0), bg: Color(0x66F0FDF4), badgeBg: Color(0xFFDCFCE7), badgeFg: Color(0xFF15803D), label: 'Approved by our team', icon: LucideIcons.circleCheck),
  'opsRejected': (border: C.red200, bg: Color(0x66FEF2F2), badgeBg: C.red100, badgeFg: C.red700, label: 'Our team needs a new copy', icon: LucideIcons.circleX),
};

String? outcomeOf(Json? doc) => doc?['opsStatus'] == 'approved' ? 'approved' : doc?['opsStatus'] == 'rejected' ? 'opsRejected' : doc?['status'] as String?;

class _DocumentCardState extends State<DocumentCard> {
  Uint8List? busyPreview; // while the check runs
  int step = 0;
  Timer? ticker;
  String error = '';
  bool open = false;

  List<Json> get questions => asList(store.config?.docType(widget.docTypeId)['questions']);

  @override
  void dispose() {
    ticker?.cancel();
    super.dispose();
  }

  Future<void> add() async {
    setState(() => error = '');
    Picked? p;
    try {
      p = await pickDocument(context);
    } on PrepareError catch (e) {
      setState(() => error = e.message);
      return;
    } catch (e) {
      setState(() => error = 'Could not read this file.');
      return;
    }
    if (p == null || !mounted) return;
    setState(() {
      busyPreview = p!.doc.preview;
      step = 0;
    });
    // Cosmetic progress through the checks while the model works.
    ticker = Timer.periodic(const Duration(milliseconds: 1400), (_) => setState(() => step = (step + 1).clamp(0, questions.length)));
    try {
      final record = await uploadDocument('/api/documents/verify', widget.docTypeId, p.doc, p.name, p.size);
      store.putDoc(record);
    } on ApiException catch (e) {
      setState(() => error = '${e.message}. Your document was not lost - please try again.');
    } finally {
      ticker?.cancel();
      if (mounted) setState(() => busyPreview = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final doc = widget.doc;
    final busy = busyPreview != null;
    final style = doc == null || busy ? null : _resultStyle[outcomeOf(doc)];
    final v = asMap(doc?['verification']);
    final file = asMap(doc?['file']);
    final needsNew = ['rejected', 'opsRejected'].contains(outcomeOf(doc));
    final spec = store.config?.docType(widget.docTypeId) ?? {};

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: style?.bg ?? Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: style?.border ?? C.slate200),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          GestureDetector(
            onTap: busy ? null : (doc == null ? add : () => FileViewerScreen.open(context, '/api/documents/${doc['id']}/file', widget.label)),
            child: _Thumb(
              preview: busyPreview,
              path: doc == null ? null : '/api/documents/${doc['id']}/preview',
              scanning: busy,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(widget.label, style: t(15.5, w: w7, c: C.slate800, h: 1.3)),
              if (widget.tag != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(widget.tag!, style: t(12, w: w6, c: C.slate400, h: 1.3))),
              if (style != null) ...[const SizedBox(height: 8), Tag(style.label, bg: style.badgeBg, fg: style.badgeFg, icon: style.icon)],
              const SizedBox(height: 8),
              if (busy)
                _Checking(questions: questions, step: step)
              else if (doc != null) ...[
                Text(
                  '${file['name']}${file['mime'] == 'application/pdf' ? ' · PDF, ${file['pageCount']} page${file['pageCount'] == 1 ? '' : 's'}' : ''} · quality ${v['qualityScore']}/100',
                  style: t(12, c: C.slate500, h: 1.35),
                ),
                if (doc['opsStatus'] == 'rejected' && doc['opsNote'] != null)
                  Padding(padding: const EdgeInsets.only(top: 8), child: Notice('Our team: ${doc['opsNote']}')),
                if (doc['opsStatus'] == null && asStrings(v['issues']).isNotEmpty)
                  Padding(padding: const EdgeInsets.only(top: 6), child: Bullets(asStrings(v['issues']), style: t(13, c: C.slate700, h: 1.35))),
              ] else
                Text((spec['description'] as String?) ?? '', style: t(13, c: C.slate500, h: 1.35)),
            ]),
          ),
        ]),
        if (!busy) ...[
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            if (doc == null)
              SmallAction(label: 'Add photo or PDF', icon: LucideIcons.cloudUpload, filled: C.violet600, onPressed: add)
            else ...[
              SmallAction(label: needsNew ? 'Upload a better copy' : 'Replace', icon: LucideIcons.refreshCcw, filled: needsNew ? C.red600 : null, onPressed: add),
              SmallAction(label: open ? 'Hide' : 'Details', icon: LucideIcons.eye, onPressed: () => setState(() => open = !open)),
              SmallAction(label: 'Open file', icon: LucideIcons.externalLink, onPressed: () => FileViewerScreen.open(context, '/api/documents/${doc['id']}/file', widget.label)),
            ],
          ]),
        ],
        if (error.isNotEmpty) ...[const SizedBox(height: 10), Notice(error)],
        if (open && doc != null && !busy) ...[
          const SizedBox(height: 12),
          const Divider(),
          const SizedBox(height: 10),
          Text('Checks', style: t(13, w: w7, c: C.slate700)),
          const SizedBox(height: 6),
          for (final a in asList(v['answers']))
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(a['answer'] == true ? LucideIcons.circleCheck : LucideIcons.circleX, size: 14, color: a['answer'] == true ? C.green600 : (a['passed'] == true ? C.slate300 : C.red500)),
                const SizedBox(width: 6),
                Expanded(child: Text(a['question'] ?? '', style: t(12.5, c: C.slate600, h: 1.35))),
              ]),
            ),
          const SizedBox(height: 10),
          Text('Read from document', style: t(13, w: w7, c: C.slate700)),
          const SizedBox(height: 4),
          KeyValues([for (final e in asMap(v['extracted']).entries) (e.key.replaceAll('_', ' '), show(e.value))], labelWidth: 110, valueStyle: t(12.5, c: C.slate700)),
          const SizedBox(height: 6),
          Text('Verified by ${v['model'] ?? 'AI'} on ${when(v['verifiedAt'])}', style: t(11, c: C.slate400)),
        ],
      ]),
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({this.preview, this.path, required this.scanning});
  final Uint8List? preview;
  final String? path;
  final bool scanning;
  @override
  Widget build(BuildContext context) {
    final empty = preview == null && path == null;
    return Container(
      width: 96,
      height: 124,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: empty ? C.slate50 : C.slate900,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: empty ? C.slate300 : C.slate200, width: 2),
      ),
      child: empty
          ? Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(LucideIcons.camera, size: 26, color: C.slate400),
              const SizedBox(height: 6),
              Text('Tap to add', style: t(11, w: w6, c: C.slate400)),
            ])
          : Stack(fit: StackFit.expand, children: [
              preview != null ? Image.memory(preview!, fit: BoxFit.contain) : NetImage(path!),
              if (scanning) const _ScanBar(),
            ]),
    );
  }
}

/// The cyan scanning line over the document while the AI inspects it (as on the web).
class _ScanBar extends StatefulWidget {
  const _ScanBar();
  @override
  State<_ScanBar> createState() => _ScanBarState();
}

class _ScanBarState extends State<_ScanBar> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 2200))..repeat(reverse: true);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (_, box) => Stack(children: [
          Container(decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x1A22D3EE), Color(0x1A2563EB)]))),
          AnimatedBuilder(
            animation: _c,
            builder: (_, _) => Positioned(
              top: Curves.easeInOut.transform(_c.value) * (box.maxHeight - 3),
              left: 0,
              right: 0,
              child: Container(
                height: 3,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(colors: [Colors.transparent, Color(0xFF22D3EE), Colors.transparent]),
                  boxShadow: [BoxShadow(color: Color(0xA622D3EE), blurRadius: 14, spreadRadius: 4)],
                ),
              ),
            ),
          ),
        ]),
      );
}

class _Checking extends StatelessWidget {
  const _Checking({required this.questions, required this.step});
  final List<Json> questions;
  final int step;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(LucideIcons.scanSearch, size: 15, color: C.cyan700),
          const SizedBox(width: 6),
          Text('Inspecting document…', style: t(13, w: w7, c: C.cyan700)),
        ]),
        const SizedBox(height: 6),
        for (final (i, q) in questions.indexed)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 1.5),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(
                width: 14,
                child: i < step
                    ? const Icon(LucideIcons.circleCheck, size: 13, color: C.cyan700)
                    : i == step
                        ? const SizedBox(width: 11, height: 11, child: CircularProgressIndicator(strokeWidth: 1.6, color: C.slate400))
                        : Container(width: 11, height: 11, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: C.slate300))),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text('${(q['q'] as String? ?? '').replaceAll('{{today}}', 'today').split('?').first}?', style: t(12, c: i < step ? C.slate700 : C.slate400, h: 1.3)),
              ),
            ]),
          ),
      ]);
}
