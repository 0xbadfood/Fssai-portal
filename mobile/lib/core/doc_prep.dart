import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;
import 'package:pdfrx/pdfrx.dart';

import 'api.dart';

// A photo or PDF made ready for the document check, the same way the web portal does it in the browser: photos as a
// JPEG up to 1600 px; PDFs rendered here (first 4 pages, sized by area so small print stays readable), with their
// text layer, and the original PDF kept. Password-protected PDFs are opened with the password, which is never sent.

const maxPdfPages = 4;
const _pdfPagePixels = 2500000;
const acceptedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

class PreparedDoc {
  PreparedDoc({required this.pages, required this.preview, this.original, this.pdfText, required this.pageCount});
  final List<String> pages; // JPEG data URLs for the vision check
  final Uint8List preview; // shown while the check runs
  final String? original; // the PDF as a data URL, if it was one
  final String? pdfText;
  final int pageCount;
}

class PdfPasswordNeeded implements Exception {
  PdfPasswordNeeded(this.incorrect);
  final bool incorrect;
  String get message => incorrect ? 'That password did not work. Please try again.' : 'This PDF is password-protected.';
}

class PrepareError implements Exception {
  PrepareError(this.message);
  final String message;
  @override
  String toString() => message;
}

bool isPdf(String name, Uint8List bytes) =>
    name.toLowerCase().endsWith('.pdf') || (bytes.length > 4 && ascii.decode(bytes.sublist(0, 5), allowInvalid: true) == '%PDF-');

Future<PreparedDoc> prepareFile(String name, Uint8List bytes, {String? password}) async {
  if (isPdf(name, bytes)) {
    if (bytes.length > 10 * 1024 * 1024) throw PrepareError('PDF is larger than 10 MB.');
    return _preparePdf(bytes, password);
  }
  final ext = name.contains('.') ? name.split('.').last.toLowerCase() : 'jpg';
  if (!acceptedExtensions.contains(ext) && !['heic', 'heif'].contains(ext)) {
    throw PrepareError('Please upload a photo (JPG, PNG, WebP) or a PDF of the document.');
  }
  if (bytes.length > 15 * 1024 * 1024) throw PrepareError('File is larger than 15 MB.');
  final out = await compute(_encodePhoto, bytes);
  if (out == null) throw PrepareError('This photo could not be read. Try another one.');
  return PreparedDoc(pages: [_dataUrl(out.$1)], preview: out.$2, pageCount: 1);
}

String _dataUrl(Uint8List jpeg) => 'data:image/jpeg;base64,${base64Encode(jpeg)}';

/// Photo -> (JPEG for the check, max 1600 px; small preview). Runs in an isolate.
(Uint8List, Uint8List)? _encodePhoto(Uint8List bytes) {
  final decoded = img.decodeImage(bytes);
  if (decoded == null) return null;
  final upright = img.bakeOrientation(decoded);
  return (_jpeg(upright, 1600, 85), _jpeg(upright, 640, 72));
}

Uint8List _jpeg(img.Image source, int maxSide, int quality) {
  final longSide = math.max(source.width, source.height);
  var image = source;
  if (longSide > maxSide) {
    image = source.width >= source.height ? img.copyResize(source, width: maxSide) : img.copyResize(source, height: maxSide);
  }
  if (image.hasAlpha) {
    final flat = img.Image(width: image.width, height: image.height)..clear(img.ColorRgb8(255, 255, 255));
    image = img.compositeImage(flat, image);
  }
  return img.encodeJpg(image, quality: quality);
}

/// Rendered PDF page (BGRA) -> (JPEG for the check; preview if asked). Runs in an isolate.
(Uint8List, Uint8List?) _encodePage((Uint8List, int, int, bool) a) {
  final (bgra, w, h, withPreview) = a;
  final page = img.Image.fromBytes(width: w, height: h, bytes: bgra.buffer, numChannels: 4, order: img.ChannelOrder.bgra);
  final rgb = page.convert(numChannels: 3);
  return (img.encodeJpg(rgb, quality: 85), withPreview ? _jpeg(rgb, 640, 72) : null);
}

Future<PreparedDoc> _preparePdf(Uint8List bytes, String? password) async {
  PdfDocument doc;
  try {
    doc = await PdfDocument.openData(
      Uint8List.fromList(bytes),
      passwordProvider: password == null ? null : createSimplePasswordProvider(password),
      firstAttemptByEmptyPassword: password == null,
    );
  } on PdfPasswordException {
    throw PdfPasswordNeeded(password != null);
  } catch (e) {
    throw PrepareError('This PDF could not be opened. Try another copy or take a photo instead.');
  }
  try {
    final pages = <String>[];
    final texts = <String>[];
    Uint8List? preview;
    final count = doc.pages.length;
    for (var n = 0; n < math.min(count, maxPdfPages); n++) {
      final page = doc.pages[n];
      final scale = math.min(3.0, math.sqrt(_pdfPagePixels / (page.width * page.height)));
      final w = (page.width * scale).round(), h = (page.height * scale).round();
      final image = await page.render(fullWidth: w.toDouble(), fullHeight: h.toDouble(), backgroundColor: 0xffffffff);
      if (image == null) throw PrepareError('This PDF could not be read. Try another copy or take a photo instead.');
      final (jpeg, small) = await compute(_encodePage, (Uint8List.fromList(image.pixels), image.width, image.height, n == 0));
      image.dispose();
      pages.add(_dataUrl(jpeg));
      preview ??= small;
      // The text layer gives the checker exact characters for names, addresses and dates (empty for scans).
      final text = (await page.loadText())?.fullText ?? '';
      texts.add('--- page ${n + 1} ---\n${text.replaceAll(RegExp(r'[ \t]+'), ' ').trim()}');
    }
    final joined = texts.join('\n');
    return PreparedDoc(
      pages: pages,
      preview: preview!,
      original: 'data:application/pdf;base64,${base64Encode(bytes)}',
      pdfText: joined.length > 20000 ? joined.substring(0, 20000) : joined,
      pageCount: count,
    );
  } finally {
    await doc.dispose();
  }
}

/// Send a prepared document for the AI check; returns the stored document record.
Future<Map<String, dynamic>> uploadDocument(String path, String docTypeId, PreparedDoc p, String fileName, int sizeBytes) async {
  final res = await api.post(
    path,
    {
      'docTypeId': docTypeId,
      'pages': p.pages,
      'original': p.original,
      'pdfText': p.pdfText,
      'pageCount': p.pageCount,
      'fileName': fileName,
      'sizeBytes': sizeBytes,
    },
    const Duration(minutes: 4),
  );
  return Map<String, dynamic>.from(res as Map);
}
