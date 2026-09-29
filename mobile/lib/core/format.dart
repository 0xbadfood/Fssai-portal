import 'package:intl/intl.dart';

final _inr = NumberFormat.decimalPattern('en_IN');

String rupees(num? n) => '₹${_inr.format(n ?? 0)}';
String grouped(num n) => _inr.format(n);

DateTime? _parse(dynamic d) => d == null ? null : DateTime.tryParse(d.toString())?.toLocal();

/// "12 Mar 2026, 4:05 pm"
String when(dynamic d) {
  final t = _parse(d);
  return t == null ? '' : DateFormat('d MMM y, h:mm a').format(t);
}

/// "12 Mar, 4:05 pm"
String whenShort(dynamic d) {
  final t = _parse(d);
  return t == null ? '' : DateFormat('d MMM, h:mm a').format(t);
}

/// "12 Mar 2026"
String day(dynamic d) {
  final t = _parse(d);
  return t == null ? '' : DateFormat('d MMM y').format(t);
}

/// "5 min ago", "3 h ago", "2 d ago"
String ago(dynamic d) {
  final t = _parse(d);
  if (t == null) return '';
  final s = DateTime.now().difference(t).inSeconds;
  if (s < 3600) return '${(s / 60).round().clamp(1, 59)} min ago';
  if (s < 86400) return '${(s / 3600).round()} h ago';
  return '${(s / 86400).round()} d ago';
}

/// Value of a detail as the ops console shows it.
String show(dynamic v) => v is List ? v.join(', ') : (v == null || v == '') ? '—' : v.toString();
