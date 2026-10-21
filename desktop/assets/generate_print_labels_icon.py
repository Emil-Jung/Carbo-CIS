"""Generate desktop/assets/print_labels.ico for the Print Labels Windows app."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
OUT = ROOT / "print_labels.ico"
SHELL_ASSETS = REPO / "shell" / "assets"

# Print Labels utility accent (Windows-style blue, distinct from CIS gold).
BG = (0, 120, 212)
BG_EDGE = (0, 103, 184)
LABEL = (255, 255, 255)
LABEL_FOLD = (230, 242, 255)


def _draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m = max(1, size // 16)
    d.rounded_rectangle(
        (m, m, size - m - 1, size - m - 1),
        radius=max(2, size // 5),
        fill=BG,
        outline=BG_EDGE,
        width=max(1, size // 32),
    )
    pad = size // 5
    lx1, ly1 = pad, pad + size // 10
    lx2, ly2 = size - pad, size - pad
    d.rounded_rectangle(
        (lx1, ly1, lx2, ly2),
        radius=max(1, size // 20),
        fill=LABEL,
    )
    fold = size // 4
    d.polygon(
        [
            (lx2 - fold, ly1),
            (lx2, ly1),
            (lx2, ly1 + fold),
        ],
        fill=LABEL_FOLD,
    )
    d.line([(lx2 - fold, ly1), (lx2 - fold, ly1 + fold), (lx2, ly1 + fold)], fill=BG_EDGE, width=max(1, size // 48))
    bar_h = max(2, size // 14)
    y = ly1 + (ly2 - ly1) // 3
    for _ in range(3):
        d.rounded_rectangle(
            (lx1 + pad // 2, y, lx2 - pad, y + bar_h),
            radius=bar_h // 2,
            fill=BG,
        )
        y += bar_h + max(1, size // 24)
    if size >= 48:
        try:
            font = ImageFont.truetype("segoeui.ttf", max(10, size // 5))
        except OSError:
            font = ImageFont.load_default()
        d.text((lx1 + pad // 2, ly2 - size // 5), "ID", fill=BG, font=font)
    return img


def main() -> None:
    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    images = [_draw_icon(s) for s, _ in sizes]
    images[0].save(
        OUT,
        format="ICO",
        sizes=sizes,
        append_images=images[1:],
    )
    print(f"Wrote {OUT}")
    SHELL_ASSETS.mkdir(parents=True, exist_ok=True)
    for name, px in (("print_labels-icon-32.png", 32), ("print_labels-icon-192.png", 192)):
        path = SHELL_ASSETS / name
        _draw_icon(px).save(path, format="PNG")
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
