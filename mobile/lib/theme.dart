import 'package:flutter/material.dart';

/// The web portal's palette (Tailwind names), so the app reads as its sibling.
abstract class C {
  static const violet50 = Color(0xFFF5F3FF);
  static const violet100 = Color(0xFFEDE9FE);
  static const violet200 = Color(0xFFDDD6FE);
  static const violet300 = Color(0xFFC4B5FD);
  static const violet400 = Color(0xFFA78BFA);
  static const violet500 = Color(0xFF8B5CF6);
  static const violet600 = Color(0xFF7C3AED);
  static const violet700 = Color(0xFF6D28D9);
  static const violet800 = Color(0xFF5B21B6);
  static const fuchsia50 = Color(0xFFFDF4FF);
  static const fuchsia100 = Color(0xFFFAE8FF);
  static const fuchsia500 = Color(0xFFD946EF);
  static const pink50 = Color(0xFFFDF2F8);
  static const pink100 = Color(0xFFFCE7F3);
  static const pink500 = Color(0xFFEC4899);
  static const pink700 = Color(0xFFBE185D);
  static const orange50 = Color(0xFFFFF7ED);
  static const orange100 = Color(0xFFFFEDD5);
  static const orange200 = Color(0xFFFED7AA);
  static const orange400 = Color(0xFFFB923C);
  static const orange500 = Color(0xFFF97316);
  static const orange600 = Color(0xFFEA580C);
  static const orange800 = Color(0xFF9A3412);
  static const orange900 = Color(0xFF7C2D12);
  static const amber50 = Color(0xFFFFFBEB);
  static const amber100 = Color(0xFFFEF3C7);
  static const amber200 = Color(0xFFFDE68A);
  static const amber400 = Color(0xFFFBBF24);
  static const amber500 = Color(0xFFF59E0B);
  static const amber600 = Color(0xFFD97706);
  static const amber700 = Color(0xFFB45309);
  static const amber800 = Color(0xFF92400E);
  static const amber900 = Color(0xFF78350F);
  static const emerald50 = Color(0xFFECFDF5);
  static const emerald100 = Color(0xFFD1FAE5);
  static const emerald200 = Color(0xFFA7F3D0);
  static const emerald500 = Color(0xFF10B981);
  static const emerald600 = Color(0xFF059669);
  static const emerald700 = Color(0xFF047857);
  static const emerald900 = Color(0xFF064E3B);
  static const teal500 = Color(0xFF14B8A6);
  static const lime500 = Color(0xFF84CC16);
  static const sky50 = Color(0xFFF0F9FF);
  static const sky100 = Color(0xFFE0F2FE);
  static const sky500 = Color(0xFF0EA5E9);
  static const sky600 = Color(0xFF0284C7);
  static const sky700 = Color(0xFF0369A1);
  static const indigo500 = Color(0xFF6366F1);
  static const cyan500 = Color(0xFF06B6D4);
  static const cyan700 = Color(0xFF0E7490);
  static const red50 = Color(0xFFFEF2F2);
  static const red100 = Color(0xFFFEE2E2);
  static const red200 = Color(0xFFFECACA);
  static const red500 = Color(0xFFEF4444);
  static const red600 = Color(0xFFDC2626);
  static const red700 = Color(0xFFB91C1C);
  static const red800 = Color(0xFF991B1B);
  static const green500 = Color(0xFF22C55E);
  static const green600 = Color(0xFF16A34A);
  static const slate50 = Color(0xFFF8FAFC);
  static const slate100 = Color(0xFFF1F5F9);
  static const slate200 = Color(0xFFE2E8F0);
  static const slate300 = Color(0xFFCBD5E1);
  static const slate400 = Color(0xFF94A3B8);
  static const slate500 = Color(0xFF64748B);
  static const slate600 = Color(0xFF475569);
  static const slate700 = Color(0xFF334155);
  static const slate800 = Color(0xFF1E293B);
  static const slate900 = Color(0xFF0F172A);
  static const slate950 = Color(0xFF020617);
}

/// Gradients used across the portal.
abstract class G {
  static const brand = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [C.violet600, C.fuchsia500, C.orange400]);
  static const brandBar = LinearGradient(colors: [C.violet600, C.fuchsia500, C.orange400]);
  static const violet = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [C.violet500, C.fuchsia500]);
  static const violetDeep = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [C.violet600, C.fuchsia500]);
  static const success = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [C.emerald500, C.teal500]);
  static const logo = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [C.green500, C.green600]);
  static const page = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xB3F5F3FF), C.slate50, C.slate50], stops: [0, 0.35, 1]);
  static LinearGradient of(Color a, Color b) => LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [a, b]);
}

TextStyle t(double size, {FontWeight w = FontWeight.w400, Color c = C.slate700, double? h, double? ls}) =>
    TextStyle(fontSize: size, fontWeight: w, color: c, height: h, letterSpacing: ls);

const w5 = FontWeight.w500, w6 = FontWeight.w600, w7 = FontWeight.w700, w8 = FontWeight.w800, w9 = FontWeight.w900;

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: C.violet600, primary: C.violet600, surface: Colors.white, brightness: Brightness.light);
  OutlineInputBorder border(Color c, [double w = 2]) => OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: c, width: w));
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    fontFamily: 'Inter',
    scaffoldBackgroundColor: C.slate50,
    splashFactory: InkSparkle.splashFactory,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      foregroundColor: C.slate900,
      titleTextStyle: TextStyle(fontFamily: 'Inter', fontSize: 18, fontWeight: w8, color: C.slate900),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      hintStyle: const TextStyle(color: C.slate400, fontWeight: FontWeight.w400),
      border: border(C.slate200),
      enabledBorder: border(C.slate200),
      focusedBorder: border(C.violet500),
      errorBorder: border(C.red500),
      focusedErrorBorder: border(C.red500),
    ),
    textSelectionTheme: const TextSelectionThemeData(cursorColor: C.violet600, selectionColor: C.violet200, selectionHandleColor: C.violet600),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      indicatorColor: C.violet100,
      height: 68,
      elevation: 0,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (s) => TextStyle(fontFamily: 'Inter', fontSize: 11.5, fontWeight: s.contains(WidgetState.selected) ? w8 : w6, color: s.contains(WidgetState.selected) ? C.violet700 : C.slate500),
      ),
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(size: 22, color: s.contains(WidgetState.selected) ? C.violet700 : C.slate500)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(backgroundColor: Colors.white, surfaceTintColor: Colors.transparent, showDragHandle: true),
    dialogTheme: const DialogThemeData(backgroundColor: Colors.white, surfaceTintColor: Colors.transparent),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: C.slate900,
      contentTextStyle: const TextStyle(fontFamily: 'Inter', fontWeight: w6, color: Colors.white),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: C.violet600),
    dividerTheme: const DividerThemeData(color: C.slate100, space: 1, thickness: 1),
    checkboxTheme: CheckboxThemeData(fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? C.violet600 : null)),
    radioTheme: RadioThemeData(fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? C.violet600 : C.slate400)),
  );
}
