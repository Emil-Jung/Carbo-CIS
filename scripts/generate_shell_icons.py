#!/usr/bin/env python3
"""Build padded PWA icons for the CIS shell from the embedded logo.

Source (in this repo):
  Carbo-CIS/CIS APP logo.png  -> copied to shell/assets/logo.png

Run:
  scripts\\GENERATE-ICONS.cmd
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Install Pillow once: pip install pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "shell" / "assets" / "logo.png"
OUT = ROOT / "shell" / "assets"
PAD_RATIO = 0.24
BG_RGBA = (12, 12, 12, 255)

OUTPUTS = {
    32: "favicon-32.png",
    180: "apple-touch-icon.png",
    192: "icon-192.png",
    512: "icon-512.png",
}


def render_icon(source: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BG_RGBA)
    inner = max(1, int(size * (1 - 2 * PAD_RATIO)))
    fitted = source.copy()
    fitted.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.paste(fitted, (x, y), fitted)
    return canvas


def main() -> int:
    if not SRC.is_file():
        print(f"Missing {SRC}. Run GENERATE-ICONS.cmd first.", file=sys.stderr)
        return 1
    base = Image.open(SRC).convert("RGBA")
    OUT.mkdir(parents=True, exist_ok=True)
    for size, name in OUTPUTS.items():
        out = OUT / name
        render_icon(base, size).save(out, "PNG", optimize=True)
        print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
