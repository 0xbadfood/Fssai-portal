import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/config.dart';
import '../theme.dart';

/// Leaf mark, name and the .com badge, as in the web header.
class Logo extends StatelessWidget {
  const Logo({super.key, this.tagline = false, this.dark = false, this.size = 1});
  final bool tagline;
  final bool dark;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 36 * size,
          height: 36 * size,
          decoration: BoxDecoration(gradient: G.logo, borderRadius: BorderRadius.circular(12 * size), boxShadow: const [BoxShadow(color: Color(0x22000000), blurRadius: 3, offset: Offset(0, 1))]),
          child: Icon(LucideIcons.leaf, size: 18 * size, color: Colors.white),
        ),
        SizedBox(width: 8 * size),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(brandName, style: t(18 * size, w: w8, c: dark ? Colors.white : C.slate900, ls: -0.2)),
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  decoration: BoxDecoration(color: C.violet50, borderRadius: BorderRadius.circular(5), border: Border.all(color: C.violet100)),
                  child: Text(brandTld, style: t(10 * size, w: w7, c: C.violet600)),
                ),
              ],
            ),
            if (tagline) Text(brandTagline, style: t(11 * size, w: w5, c: dark ? C.slate300 : C.slate500)),
          ],
        ),
      ],
    );
  }
}
