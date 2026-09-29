import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme.dart';

/// A page inside the app: the portal's soft violet wash, a pull-to-refresh list, and the page title.
class PageList extends StatelessWidget {
  const PageList({super.key, required this.children, this.onRefresh, this.padding, this.controller});
  final List<Widget> children;
  final Future<void> Function()? onRefresh;
  final EdgeInsets? padding;
  final ScrollController? controller;

  @override
  Widget build(BuildContext context) {
    final list = ListView(
      controller: controller,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: padding ?? const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: children,
    );
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: G.page),
      child: onRefresh == null ? list : RefreshIndicator(color: C.violet600, onRefresh: onRefresh!, child: list),
    );
  }
}

/// Vertical spacing between blocks (the web's space-y-5).
List<Widget> spaced(List<Widget> items, [double gap = 16]) => [
      for (var i = 0; i < items.length; i++) ...[if (i > 0) SizedBox(height: gap), items[i]],
    ];

class PageHeader extends StatelessWidget {
  const PageHeader({super.key, this.emoji, required this.title, this.subtitle, this.trailing});
  final String? emoji;
  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (emoji != null) ...[Text(emoji!, style: const TextStyle(fontSize: 28)), const SizedBox(width: 10)],
              Expanded(child: Text(title, style: t(26, w: w8, c: C.slate900, ls: -0.5, h: 1.15))),
              ?trailing,
            ],
          ),
          if (subtitle != null) ...[const SizedBox(height: 6), Text(subtitle!, style: t(15, c: C.slate500, h: 1.4))],
        ],
      ),
    );
  }
}

/// White rounded card (rounded-3xl, hairline border, soft shadow).
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(20), this.color = Colors.white, this.borderColor = C.slate100, this.radius = 24, this.onTap, this.gradient});
  final Widget child;
  final EdgeInsets padding;
  final Color color;
  final Color borderColor;
  final double radius;
  final VoidCallback? onTap;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(radius);
    return Container(
      decoration: BoxDecoration(
        color: gradient == null ? color : null,
        gradient: gradient,
        borderRadius: r,
        border: Border.all(color: borderColor),
        boxShadow: const [BoxShadow(color: Color(0x0A0F172A), blurRadius: 6, offset: Offset(0, 1))],
      ),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(borderRadius: r, onTap: onTap, child: Padding(padding: padding, child: child)),
      ),
    );
  }
}

/// A tinted panel (the web's bg-orange-50 intro boxes and the like).
class Tint extends StatelessWidget {
  const Tint({super.key, required this.color, required this.child, this.padding = const EdgeInsets.all(18), this.radius = 24, this.border});
  final Color color;
  final Widget child;
  final EdgeInsets padding;
  final double radius;
  final Color? border;
  @override
  Widget build(BuildContext context) => Container(
        padding: padding,
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(radius), border: border == null ? null : Border.all(color: border!)),
        child: child,
      );
}

/// The big gradient banner with two soft circles, as on the web's dashboard and application pages.
class GradientHero extends StatelessWidget {
  const GradientHero({super.key, required this.child, this.gradient = G.brand, this.padding = const EdgeInsets.all(22), this.radius = 28, this.shadow = C.violet200});
  final Widget child;
  final Gradient gradient;
  final EdgeInsets padding;
  final double radius;
  final Color? shadow;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: shadow == null ? null : [BoxShadow(color: shadow!.withValues(alpha: 0.7), blurRadius: 24, offset: const Offset(0, 10))],
      ),
      child: Stack(
        children: [
          Positioned(right: -40, top: -40, child: _circle(150)),
          Positioned(right: 70, bottom: -70, child: _circle(150)),
          Padding(padding: padding, child: DefaultTextStyle.merge(style: const TextStyle(color: Colors.white), child: child)),
        ],
      ),
    );
  }

  Widget _circle(double s) => Container(width: s, height: s, decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.1)));
}

enum Tone { violet, green, white, dark, red }

/// The portal's big, friendly button (rounded-2xl, bold, shadow).
class BigButton extends StatelessWidget {
  const BigButton({super.key, required this.label, this.icon, this.trailingIcon, this.onPressed, this.tone = Tone.violet, this.busy = false, this.expand = true, this.small = false, this.gradient});
  final String label;
  final IconData? icon;
  final IconData? trailingIcon;
  final VoidCallback? onPressed;
  final Tone tone;
  final bool busy;
  final bool expand;
  final bool small;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;
    final (bg, fg, shadow, border) = switch (tone) {
      Tone.violet => (C.violet600, Colors.white, C.violet200, null),
      Tone.green => (C.emerald600, Colors.white, C.emerald100, null),
      Tone.white => (Colors.white, C.slate700, null, C.slate200),
      Tone.dark => (C.slate900, Colors.white, null, null),
      Tone.red => (C.red600, Colors.white, null, null),
    };
    final r = BorderRadius.circular(small ? 14 : 18);
    final content = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (busy)
          SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.4, color: fg))
        else if (icon != null)
          Icon(icon, size: small ? 17 : 20, color: fg),
        if (busy || icon != null) const SizedBox(width: 8),
        Flexible(child: Text(label, textAlign: TextAlign.center, style: t(small ? 14.5 : 17, w: w7, c: fg))),
        if (trailingIcon != null && !busy) ...[const SizedBox(width: 8), Icon(trailingIcon, size: small ? 17 : 20, color: fg)],
      ],
    );
    return AnimatedOpacity(
      duration: const Duration(milliseconds: 150),
      opacity: enabled || busy ? 1 : 0.4,
      child: Container(
        decoration: BoxDecoration(
          color: gradient == null ? bg : null,
          gradient: gradient,
          borderRadius: r,
          border: border == null ? null : Border.all(color: border, width: 2),
          boxShadow: shadow == null || !enabled ? null : [BoxShadow(color: shadow.withValues(alpha: 0.9), blurRadius: 16, offset: const Offset(0, 6))],
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            borderRadius: r,
            onTap: enabled ? onPressed : null,
            child: Padding(padding: EdgeInsets.symmetric(horizontal: small ? 14 : 22, vertical: small ? 11 : 16), child: content),
          ),
        ),
      ),
    );
  }
}

/// A small outlined action (the web's text-xs bordered buttons).
class SmallAction extends StatelessWidget {
  const SmallAction({super.key, required this.label, this.icon, this.onPressed, this.color = C.slate600, this.filled, this.border = C.slate200});
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final Color color;
  final Color? filled;
  final Color border;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(12);
    return Opacity(
      opacity: onPressed == null ? 0.45 : 1,
      child: Material(
        color: filled ?? Colors.white,
        shape: RoundedRectangleBorder(borderRadius: r, side: filled == null ? BorderSide(color: border) : BorderSide.none),
        child: InkWell(
          borderRadius: r,
          onTap: onPressed,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (icon != null) ...[Icon(icon, size: 14, color: filled != null ? Colors.white : color), const SizedBox(width: 6)],
              Text(label, style: t(13, w: w7, c: filled != null ? Colors.white : color)),
            ]),
          ),
        ),
      ),
    );
  }
}

/// A selectable pill (choices in Details, support contact, filters).
class Pill extends StatelessWidget {
  const Pill({super.key, required this.label, required this.on, this.onTap, this.emoji, this.dense = false, this.solid = true});
  final String label;
  final bool on;
  final VoidCallback? onTap;
  final String? emoji;
  final bool dense;
  final bool solid;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(dense ? 999 : 16);
    final bg = on ? (solid ? C.violet600 : C.violet50) : Colors.white;
    final fg = on ? (solid ? Colors.white : C.violet800) : C.slate700;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      decoration: BoxDecoration(color: bg, borderRadius: r, border: Border.all(color: on ? C.violet500 : C.slate200, width: 2)),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          borderRadius: r,
          onTap: onTap,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: dense ? 14 : 16, vertical: dense ? 8 : 12),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (on) ...[Icon(LucideIcons.check, size: 16, color: fg), const SizedBox(width: 6)],
              if (emoji != null) ...[Text(emoji!, style: const TextStyle(fontSize: 16)), const SizedBox(width: 6)],
              Flexible(child: Text(label, style: t(dense ? 14 : 15.5, w: w7, c: fg))),
            ]),
          ),
        ),
      ),
    );
  }
}

/// A rounded status / info tag.
class Tag extends StatelessWidget {
  const Tag(this.label, {super.key, this.bg = C.slate100, this.fg = C.slate700, this.icon, this.border});
  final String label;
  final Color bg;
  final Color fg;
  final IconData? icon;
  final Color? border;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999), border: border == null ? null : Border.all(color: border!)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[Icon(icon, size: 12, color: fg), const SizedBox(width: 4)],
          Flexible(child: Text(label, style: t(12, w: w7, c: fg), overflow: TextOverflow.ellipsis)),
        ]),
      );
}

class Notice extends StatelessWidget {
  const Notice(this.text, {super.key, this.tone = 'red', this.icon});
  final String text;
  final String tone; // red | green | amber | slate | violet
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      'green' => (C.emerald50, C.emerald700),
      'amber' => (C.amber50, C.amber900),
      'slate' => (C.slate100, C.slate700),
      'violet' => (C.violet50, C.violet800),
      _ => (C.red50, C.red700),
    };
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (icon != null) ...[Padding(padding: const EdgeInsets.only(top: 1), child: Icon(icon, size: 17, color: fg)), const SizedBox(width: 8)],
        Expanded(child: Text(text, style: t(14, w: w6, c: fg, h: 1.4))),
      ]),
    );
  }
}

/// Grey pulsing placeholders while a page loads.
class LoadingBlocks extends StatefulWidget {
  const LoadingBlocks({super.key, this.count = 3});
  final int count;
  @override
  State<LoadingBlocks> createState() => _LoadingBlocksState();
}

class _LoadingBlocksState extends State<LoadingBlocks> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat(reverse: true);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
        opacity: Tween(begin: 0.45, end: 1.0).animate(_c),
        child: Column(children: spaced([for (var i = 0; i < widget.count; i++) Container(height: 110, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.8), borderRadius: BorderRadius.circular(24)))])),
      );
}

class Spinner extends StatelessWidget {
  const Spinner({super.key, this.size = 26, this.color = C.violet400});
  final double size;
  final Color color;
  @override
  Widget build(BuildContext context) => Center(child: SizedBox(width: size, height: size, child: CircularProgressIndicator(strokeWidth: 3, color: color)));
}

/// The assistant's avatar and speech bubble (the intake chat).
class Bubble extends StatelessWidget {
  const Bubble({super.key, required this.child, this.small = false, this.avatar = 40});
  final Widget child;
  final bool small;
  final double avatar;
  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AssistantAvatar(size: avatar),
          const SizedBox(width: 10),
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(topLeft: Radius.circular(6), topRight: Radius.circular(18), bottomLeft: Radius.circular(18), bottomRight: Radius.circular(18)),
                boxShadow: [BoxShadow(color: Color(0x0F0F172A), blurRadius: 6, offset: Offset(0, 1))],
              ),
              child: DefaultTextStyle.merge(style: t(small ? 15 : 16.5, c: C.slate700, h: 1.45), child: child),
            ),
          ),
          const SizedBox(width: 30),
        ],
      );
}

class AssistantAvatar extends StatelessWidget {
  const AssistantAvatar({super.key, this.size = 40});
  final double size;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(shape: BoxShape.circle, gradient: G.violet, boxShadow: [BoxShadow(color: Color(0x33000000), blurRadius: 4, offset: Offset(0, 1))]),
        child: Icon(LucideIcons.sparkles, size: size * 0.45, color: Colors.white),
      );
}

class UserBubble extends StatelessWidget {
  const UserBubble(this.text, {super.key, this.small = false});
  final String text;
  final bool small;
  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.centerRight,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.78),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 10),
            decoration: const BoxDecoration(
              color: C.violet600,
              borderRadius: BorderRadius.only(topLeft: Radius.circular(18), topRight: Radius.circular(18), bottomLeft: Radius.circular(18), bottomRight: Radius.circular(6)),
            ),
            child: Text(text, style: t(small ? 14.5 : 16, w: w5, c: Colors.white, h: 1.35)),
          ),
        ),
      );
}

/// Three bouncing dots while the assistant thinks.
class TypingDots extends StatefulWidget {
  const TypingDots({super.key});
  @override
  State<TypingDots> createState() => _TypingDotsState();
}

class _TypingDotsState extends State<TypingDots> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (_, _) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < 3; i++)
              Transform.translate(
                offset: Offset(0, -5 * _bounce((_c.value - i * 0.16) % 1)),
                child: Container(margin: const EdgeInsets.symmetric(horizontal: 2.5), width: 9, height: 9, decoration: const BoxDecoration(color: C.violet400, shape: BoxShape.circle)),
              ),
          ],
        ),
      );

  double _bounce(double x) => x < 0.5 ? Curves.easeOut.transform(x * 2) * (1 - x * 2) * 4 * 0.5 : 0;
}

/// A slim progress bar (amber → emerald, as the documents progress on the web).
class ProgressBar extends StatelessWidget {
  const ProgressBar({super.key, required this.value, this.height = 12, this.track = C.amber100, this.gradient = const LinearGradient(colors: [C.amber400, C.emerald500])});
  final double value;
  final double height;
  final Color track;
  final Gradient gradient;
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(99),
        child: Container(
          height: height,
          color: track,
          alignment: Alignment.centerLeft,
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: value.clamp(0, 1)),
            duration: const Duration(milliseconds: 500),
            builder: (_, v, _) => FractionallySizedBox(widthFactor: v, child: Container(decoration: BoxDecoration(gradient: gradient, borderRadius: BorderRadius.circular(99)))),
          ),
        ),
      );
}

/// Label / value rows (the web's <dl> grids).
class KeyValues extends StatelessWidget {
  const KeyValues(this.rows, {super.key, this.labelWidth = 120, this.valueStyle});
  final List<(String, String)> rows;
  final double labelWidth;
  final TextStyle? valueStyle;
  @override
  Widget build(BuildContext context) => Column(
        children: [
          for (final (k, v) in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(width: labelWidth, child: Text(k, style: t(14, c: C.slate500, h: 1.35))),
                const SizedBox(width: 10),
                Expanded(child: Text(v, style: valueStyle ?? t(14.5, w: w7, c: C.slate900, h: 1.35))),
              ]),
            ),
        ],
      );
}

class Bullets extends StatelessWidget {
  const Bullets(this.items, {super.key, this.style, this.bullet = '•'});
  final List<String> items;
  final TextStyle? style;
  final String bullet;
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final x in items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2.5),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('$bullet ', style: style ?? t(15, c: C.slate700, h: 1.4)),
                Expanded(child: Text(x, style: style ?? t(15, c: C.slate700, h: 1.4))),
              ]),
            ),
        ],
      );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.note, this.icon, this.iconColor = C.violet500});
  final String text;
  final String? note;
  final IconData? icon;
  final Color iconColor;
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            if (icon != null) ...[Icon(icon, size: 20, color: iconColor), const SizedBox(width: 8)],
            Expanded(child: Text(text, style: t(19, w: w8, c: C.slate900, ls: -0.2))),
          ]),
          if (note != null) ...[const SizedBox(height: 3), Text(note!, style: t(14, c: C.slate500, h: 1.4))],
        ],
      );
}

/// A rounded square icon badge.
class IconBadge extends StatelessWidget {
  const IconBadge(this.icon, {super.key, this.bg = C.violet50, this.fg = C.violet600, this.size = 44, this.gradient});
  final IconData icon;
  final Color bg;
  final Color fg;
  final double size;
  final Gradient? gradient;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: gradient == null ? bg : null, gradient: gradient, borderRadius: BorderRadius.circular(size * 0.32)),
        child: Icon(icon, size: size * 0.48, color: fg),
      );
}

void toast(BuildContext context, String message) =>
    ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(SnackBar(content: Text(message)));

Future<bool> confirm(BuildContext context, {required String title, String? body, String yes = 'Yes', String no = 'No', bool danger = false}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: Text(title, style: t(19, w: w8, c: C.slate900)),
      content: body == null ? null : Text(body, style: t(15, c: C.slate600, h: 1.4)),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: Text(no, style: t(15, w: w7, c: C.slate600))),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: danger ? C.red600 : C.violet600, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
          onPressed: () => Navigator.pop(c, true),
          child: Text(yes, style: t(15, w: w7, c: Colors.white)),
        ),
      ],
    ),
  );
  return ok ?? false;
}

/// Text input with a label above (sign-in forms, support).
class LabeledField extends StatelessWidget {
  const LabeledField({super.key, required this.label, required this.controller, this.hint, this.keyboard, this.obscure = false, this.maxLines = 1, this.autofill, this.action, this.onSubmitted, this.maxLength});
  final String label;
  final TextEditingController controller;
  final String? hint;
  final TextInputType? keyboard;
  final bool obscure;
  final int maxLines;
  final Iterable<String>? autofill;
  final TextInputAction? action;
  final ValueChanged<String>? onSubmitted;
  final int? maxLength;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: t(13.5, w: w7, c: C.slate600)),
          const SizedBox(height: 6),
          TextField(
            controller: controller,
            keyboardType: keyboard,
            obscureText: obscure,
            maxLines: maxLines,
            maxLength: maxLength,
            autofillHints: autofill,
            textInputAction: action,
            onSubmitted: onSubmitted,
            style: t(16, c: C.slate900),
            decoration: InputDecoration(hintText: hint, counterText: ''),
          ),
        ],
      );
}
