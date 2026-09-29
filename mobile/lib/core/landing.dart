import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

// The welcome screen's licence-check conversation lives on the server; only its session id is kept here, and it is
// handed to the first application after sign-up (as the web portal does with localStorage).
const _key = 'mfl.intakeSession';

Future<void> saveLandingSession(String? id) async {
  final p = await SharedPreferences.getInstance();
  if (id == null) {
    await p.remove(_key);
  } else {
    await p.setString(_key, jsonEncode({'id': id, 'at': DateTime.now().millisecondsSinceEpoch}));
  }
}

/// The session id from the last 7 days, or null.
Future<String?> landingSession() async {
  try {
    final p = await SharedPreferences.getInstance();
    final d = jsonDecode(p.getString(_key) ?? '{}') as Map;
    final at = d['at'] as int?;
    if (d['id'] is String && at != null && DateTime.now().millisecondsSinceEpoch - at < 7 * 86400000) return d['id'] as String;
  } catch (_) {}
  return null;
}

/// The session id, removed on read so it is handed over once.
Future<String?> takeLandingSession() async {
  final id = await landingSession();
  await saveLandingSession(null);
  return id;
}
