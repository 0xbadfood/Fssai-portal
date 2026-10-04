#!/usr/bin/env bash
# Rebuilds the brand images from the SVG sources in this folder (needs rsvg-convert, ImageMagick, google-chrome).
#   mark.svg            → public/favicon.svg, favicon.ico (16/32/48), logo-512.png, mobile/assets/brand/mark.png (header logo)
#   mark-square.svg     → public/apple-touch-icon.png, mobile/assets/icon/icon.png (launchers apply their own mask)
#   mark-foreground.svg → mobile/assets/icon/foreground.png (Android adaptive icon, on adaptive_icon_background)
#   og-default.svg      → public/og-default.png (rendered in Chrome so the text uses Inter)
# After changing the app icons, run `dart run flutter_launcher_icons` in mobile/.
set -euo pipefail
B=$(cd "$(dirname "$0")" && pwd); R=$(cd "$B/../../.." && pwd); T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
P=$R/public; M=$R/mobile/assets/icon

cp "$B/mark.svg" "$P/favicon.svg"
for s in 16 32 48; do rsvg-convert -w $s -h $s "$B/mark.svg" -o "$T/f$s.png"; done
convert "$T/f16.png" "$T/f32.png" "$T/f48.png" "$P/favicon.ico"
rsvg-convert -w 512 -h 512 "$B/mark.svg" | convert - -strip "$P/logo-512.png"
mkdir -p "$R/mobile/assets/brand"
rsvg-convert -w 144 -h 144 "$B/mark.svg" | convert - -strip "$R/mobile/assets/brand/mark.png"
rsvg-convert -w 180 -h 180 "$B/mark-square.svg" | convert - -strip "$P/apple-touch-icon.png"
rsvg-convert -w 1024 -h 1024 "$B/mark-square.svg" | convert - -strip "$M/icon.png"
rsvg-convert -w 1024 -h 1024 "$B/mark-foreground.svg" | convert - -strip "$M/foreground.png"

F=$R/mobile/assets/fonts
cat > "$T/og.html" <<HTML
<!doctype html><html><head><style>
@font-face{font-family:Inter;font-weight:400;src:url(file://$F/Inter-Regular.ttf)}
@font-face{font-family:Inter;font-weight:800;src:url(file://$F/Inter-ExtraBold.ttf)}
html,body{margin:0;width:1200px;height:630px;overflow:hidden}
</style></head><body>$(cat "$B/og-default.svg")</body></html>
HTML
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --window-size=1200,900 --virtual-time-budget=3000 --screenshot="$T/og.png" "file://$T/og.html" 2>/dev/null
convert "$T/og.png" -crop 1200x630+0+0 +repage -strip "$P/og-default.png"
echo "brand images rebuilt"
