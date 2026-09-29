import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'config.dart';

/// An error the server explained (its `error` text), or a network problem.
class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;
  @override
  String toString() => message;
}

/// The portal's JSON API. The session token goes as a bearer token; the server answers sign-in with it because
/// every request says it comes from the app (x-mfl-client). Only the server works anything out: screens show
/// what it sends, as the web portal does.
class Api {
  Api._();
  static final Api instance = Api._();

  final http.Client _client = http.Client();
  String? token;

  /// Called when the server says the session is gone (401), so the app can go back to sign-in.
  VoidCallback? onSignedOut;

  Map<String, String> _headers({bool json = false}) => {
        'accept': 'application/json',
        'x-mfl-client': 'app',
        if (json) 'content-type': 'application/json',
        if (token != null) 'authorization': 'Bearer $token',
      };

  Uri _uri(String path) => Uri.parse('$apiBase$path');

  Future<dynamic> get(String path, {Duration timeout = const Duration(seconds: 45)}) =>
      _send(() => _client.get(_uri(path), headers: _headers()).timeout(timeout));

  /// A POST always sends JSON (the server refuses anything else), even with nothing to send.
  Future<dynamic> post(String path, [Object? body, Duration timeout = const Duration(seconds: 90)]) =>
      _send(() => _client.post(_uri(path), headers: _headers(json: true), body: jsonEncode(body ?? {})).timeout(timeout));

  /// A stored file (document preview or original), with its content type.
  Future<({Uint8List bytes, String mime})> bytes(String path) async {
    final res = await _guard(() => _client.get(_uri(path), headers: _headers()).timeout(const Duration(seconds: 60)));
    if (res.statusCode != 200) throw _error(res);
    return (bytes: res.bodyBytes, mime: (res.headers['content-type'] ?? 'application/octet-stream').split(';').first);
  }

  Future<dynamic> _send(Future<http.Response> Function() call) async {
    final res = await _guard(call);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    }
    throw _error(res);
  }

  Future<http.Response> _guard(Future<http.Response> Function() call) async {
    try {
      return await call();
    } on TimeoutException {
      throw ApiException(504, 'The server took too long to answer. Please try again.');
    } on SocketException {
      throw ApiException(0, 'Could not reach the server. Check your connection.');
    } on http.ClientException {
      throw ApiException(0, 'Could not reach the server. Check your connection.');
    }
  }

  ApiException _error(http.Response res) {
    String? message;
    try {
      message = (jsonDecode(utf8.decode(res.bodyBytes)) as Map)['error'] as String?;
    } catch (_) {}
    if (res.statusCode == 401 && token != null) onSignedOut?.call();
    return ApiException(res.statusCode, message ?? 'Something went wrong (${res.statusCode}). Please try again.');
  }
}

final api = Api.instance;
