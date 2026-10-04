import 'package:flutter/material.dart';
import '../core/config.dart';
import '../theme.dart';

/// Brand mark (assets/brand/mark.png, built by scripts/seo/brand/build.sh) and the wordmark, as in the web header.
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
        Image.asset('assets/brand/mark.png', width: 36 * size, height: 36 * size, filterQuality: FilterQuality.medium),
        SizedBox(width: 8 * size),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text.rich(
              TextSpan(
                style: t(18 * size, w: w8, c: dark ? Colors.white : C.slate900, ls: -0.2),
                children: [
                  for (final part in brandName.split(RegExp('(?=Food)|(?<=Food)')))
                    TextSpan(text: part, style: part == 'Food' ? TextStyle(color: dark ? C.green500 : C.green600) : null),
                  TextSpan(text: brandTld, style: TextStyle(fontSize: 12 * size, fontWeight: w7, color: dark ? C.orange400 : C.orange600, letterSpacing: 0)),
                ],
              ),
            ),
            if (tagline) Text(brandTagline, style: t(11 * size, w: w5, c: dark ? C.slate300 : C.slate500)),
          ],
        ),
      ],
    );
  }
}
