import 'dart:async';

import 'package:flutter/foundation.dart';

import 'api.dart';
import 'landing.dart';

typedef Json = Map<String, dynamic>;

Json asMap(dynamic v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
List<Json> asList(dynamic v) => v is List ? v.map(asMap).toList() : <Json>[];
List<String> asStrings(dynamic v) => v is List ? v.map((e) => e.toString()).toList() : <String>[];

/// Labels and checks for each document type, support topics: served by /api/app/config so the app and the web
/// show the same.
class AppConfig {
  AppConfig(this.raw);
  final Json raw;
  Json get docTypes => asMap(raw['docTypes']);
  Json docType(String id) => asMap(docTypes[id]);
  String docLabel(String id) => (docType(id)['label'] as String?) ?? id;
  List<Json> get supportTopics => asList(raw['supportTopics']);
  List<Json> get contactVia => asList(raw['contactVia']);
}

/// Accepted, or waiting for an officer's check: good enough to continue. Our team's review overrides the AI either way.
bool isDocOk(Json? doc) {
  if (doc == null) return false;
  final ops = doc['opsStatus'];
  if (ops != null) return ops == 'approved';
  return doc['status'] == 'accepted' || doc['status'] == 'review';
}

/// The signed-in customer's application and documents, shared by every tab (as the web's useApplication and
/// useUserDocuments). Requests run one at a time, so answers arrive in the order the taps were made. Details being
/// edited are a draft: autosaved after a pause and sent along with the next update, so edits are never lost.
class Store extends ChangeNotifier {
  Store._();
  static final Store instance = Store._();

  AppConfig? config;
  Json? app;
  bool appLoaded = false;
  Map<String, Json> docs = {};
  bool docsLoaded = false;

  bool busy = false;
  String error = '';
  String draftState = 'saved'; // saved | pending | saving

  Future<void> _queue = Future.value();
  Json? _draft;
  Timer? _timer;

  Json get plan => asMap(app?['plan']);
  Json get intake => asMap(app?['intake']);
  String? get id => app?['id'] as String?;
  bool get ready => app?['status'] == 'ready';

  void reset() {
    app = null;
    appLoaded = false;
    docs = {};
    docsLoaded = false;
    error = '';
    _draft = null;
    _timer?.cancel();
    notifyListeners();
  }

  Future<void> loadConfig() async {
    if (config != null) return;
    try {
      config = AppConfig(asMap(await api.get('/api/app/config')));
      notifyListeners();
    } catch (_) {}
  }

  /// The latest application (null if there is none yet). Never creates one.
  Future<void> loadCurrent() async {
    try {
      final d = await api.get('/api/applications/current');
      app = d['application'] == null ? null : asMap(d['application']);
      error = '';
    } on ApiException catch (e) {
      error = e.message;
    }
    appLoaded = true;
    notifyListeners();
  }

  /// My Application: the latest application, created on the first visit (taking over the welcome-screen chat).
  Future<void> ensureApplication() async {
    if (!appLoaded) await loadCurrent();
    if (app != null || error.isNotEmpty) return;
    await _run(() async => (await api.post('/api/applications', {'intakeSession': await takeLandingSession()}))['application']);
  }

  Future<void> loadDocs() async {
    try {
      final list = asList(await api.get('/api/documents'));
      docs = {for (final d in list) d['docTypeId'] as String: d};
    } catch (_) {}
    docsLoaded = true;
    notifyListeners();
  }

  /// Home, Vault and Premises show fresh data each time they open.
  Future<void> refreshAll() => Future.wait([loadCurrent(), loadDocs(), loadConfig()]);

  Future<Json?> _run(Future<dynamic> Function() fn, {bool quiet = false}) {
    final job = _queue.then((_) async {
      if (!quiet) busy = true;
      error = '';
      notifyListeners();
      try {
        final next = await fn();
        if (next != null) app = asMap(next);
        appLoaded = true;
        return app;
      } on ApiException catch (e) {
        error = e.message;
        return null;
      } finally {
        if (!quiet) busy = false;
        notifyListeners();
      }
    });
    _queue = job.then((_) {}, onError: (_) {});
    return job;
  }

  Future<dynamic> _call(String action, [Object? body]) async => (await api.post('/api/applications/$id/$action', body))['application'];

  Json _takeDraft([Json? patch]) {
    _timer?.cancel();
    final p = patch ?? <String, dynamic>{};
    if (_draft == null) return p;
    final info = {..._draft!, ...asMap(p['info'])};
    _draft = null;
    return {...p, 'info': info};
  }

  Future<Json?> update(Json patch) => _run(() {
        final body = _takeDraft(patch);
        draftState = 'saved';
        return _call('update', body);
      });

  Future<Json?> go(String step) => update({'step': step});

  void saveDraft(Json info) {
    _draft = info;
    draftState = 'pending';
    notifyListeners();
    _timer?.cancel();
    _timer = Timer(const Duration(seconds: 1), () {
      _run(() async {
        final body = _takeDraft();
        if (body['info'] == null) return app;
        draftState = 'saving';
        notifyListeners();
        final next = await _call('update', body);
        if (_draft == null) draftState = 'saved';
        return next;
      }, quiet: true);
    });
  }

  /// Leaving the Details step (or the app going to the background) saves what was typed straight away.
  void flushDraft() {
    if (_draft == null || id == null) return;
    _timer?.cancel();
    _run(() {
      final body = _takeDraft();
      draftState = 'saved';
      return _call('update', body);
    }, quiet: true);
  }

  Future<Json?> answer(Json payload) => _run(() => _call('answer', payload));
  Future<Json?> reask(String questionId) => _run(() => _call('reask', {'questionId': questionId}));
  Future<Json?> undo() => _run(() => _call('undo'));
  Future<Json?> restart() => _run(() => _call('restart'));
  Future<Json?> startNew() => _run(() async => (await api.post('/api/applications', {}))['application']);

  /// After a document upload the plan (documents, details read from them) is worked out again on the server.
  void putDoc(Json record) {
    docs = {...docs, record['docTypeId'] as String: record};
    notifyListeners();
    if (app != null) _run(() async => (await api.get('/api/applications/current'))['application'], quiet: true);
  }

  void rate(String rating) {
    if (id == null) return;
    api.post('/api/applications/$id/rate', {'rating': rating}).catchError((_) => null);
  }
}

final store = Store.instance;
