import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api.dart';

/// Who is signed in: customers only. Team accounts (ops, admin, expert) use the web console; the server refuses
/// them here. The token is kept in the platform's secure storage (Keychain / Keystore).
class Session extends ChangeNotifier {
  Session._();
  static final Session instance = Session._();

  static const _storage = FlutterSecureStorage();
  static const _key = 'mfl.session';

  Map<String, dynamic>? user;
  bool ready = false;

  bool get signedIn => user != null;
  String? get role => user?['role'] as String?;
  String get name => (user?['name'] as String?) ?? '';
  String get firstName => name.trim().isEmpty ? 'there' : name.trim().split(RegExp(r'\s+')).first;
  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).take(2);
    final s = parts.map((p) => p[0]).join().toUpperCase();
    return s.isEmpty ? 'U' : s;
  }

  Future<void> restore() async {
    api.onSignedOut = _expired;
    try {
      api.token = await _storage.read(key: _key);
      if (api.token != null) {
        final d = await api.get('/api/auth/me');
        user = Map<String, dynamic>.from(d['user'] as Map);
      }
    } on ApiException catch (e) {
      if (e.status == 401) await _forget();
    } catch (_) {}
    ready = true;
    notifyListeners();
  }

  Future<void> _signedIn(dynamic d) async {
    api.token = d['token'] as String?;
    if (api.token != null) await _storage.write(key: _key, value: api.token);
    user = Map<String, dynamic>.from(d['user'] as Map);
    notifyListeners();
  }

  Future<void> login(String email, String password) async =>
      _signedIn(await api.post('/api/auth/login', {'email': email.trim(), 'password': password}));

  Future<void> signup(Map<String, String> form) async => _signedIn(await api.post('/api/auth/signup', form));

  Future<void> logout() async {
    try {
      await api.post('/api/auth/logout');
    } catch (_) {}
    await _forget();
    notifyListeners();
  }

  Future<void> _forget() async {
    api.token = null;
    user = null;
    await _storage.delete(key: _key);
  }

  void _expired() {
    if (user == null) return;
    _forget().then((_) => notifyListeners());
  }
}

final session = Session.instance;
