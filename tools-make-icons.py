"""Generates the Cargora Manager app icons.

Pure standard library - no Pillow, no sharp, nothing installed on anyone's machine. A PNG
is a zlib stream of filtered scanlines, which is about thirty lines to write, and that is a
far smaller cost than adding an image toolchain to a project that needs six files once.

Everything is rendered at 4x and box-downsampled, which is what gives the curves clean edges
- drawing straight to 1024 leaves visibly jagged diagonals on the ring.

The mark: a bold "C" over the same indigo gradient the app's own headers use, with a cargo
container stacked in the gap. It reads as a monogram at a glance and as freight close up,
and it stays legible at 48px where anything more detailed turns to mush.
"""
import struct
import zlib
from pathlib import Path

OUT = Path(r"C:\Users\abcom\Desktop\office\Cargora_IRN\cargora-manager-app\assets")

SS = 4  # supersample factor

# The app's own header gradient (src/theme/index.ts), so the icon and the app match.
G0 = (0x4F, 0x46, 0xE5)
G1 = (0x63, 0x66, 0xF1)
G2 = (0x5B, 0x6C, 0xF9)
WHITE = (255, 255, 255)


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def gradient_at(u, v):
    """Diagonal three-stop gradient, u/v in 0..1."""
    t = max(0.0, min(1.0, (u + v) / 2))
    return lerp(G0, G1, t * 2) if t < 0.5 else lerp(G1, G2, (t - 0.5) * 2)


def write_png(path: Path, pixels, w: int, h: int) -> None:
    """pixels: flat list of (r,g,b,a) tuples, row-major."""
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter type 0 (None) for each scanline
        row = pixels[y * w:(y + 1) * w]
        for r, g, b, a in row:
            raw += bytes((r, g, b, a))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))  # 8-bit RGBA
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def downsample(buf, w, h, factor):
    """Box filter - this is the anti-aliasing."""
    ow, oh = w // factor, h // factor
    out = []
    n = factor * factor
    for y in range(oh):
        for x in range(ow):
            r = g = b = a = 0
            for dy in range(factor):
                row = (y * factor + dy) * w
                for dx in range(factor):
                    pr, pg, pb, pa = buf[row + x * factor + dx]
                    # Weight colour by alpha so transparent pixels do not drag edges to black.
                    r += pr * pa
                    g += pg * pa
                    b += pb * pa
                    a += pa
            if a:
                out.append((round(r / a), round(g / a), round(b / a), round(a / n)))
            else:
                out.append((0, 0, 0, 0))
    return out, ow, oh


def rounded_rect_alpha(x, y, size, radius):
    """1.0 inside the rounded square, 0.0 outside."""
    r = radius
    cx = min(max(x, r), size - r)
    cy = min(max(y, r), size - r)
    dx, dy = x - cx, y - cy
    return 1.0 if dx * dx + dy * dy <= r * r else 0.0


def render(size: int, *, background: bool, mark: bool, mark_color=WHITE, scale=1.0):
    """One icon. `background` paints the gradient tile; `mark` paints the C + container."""
    S = size * SS
    buf = []

    cx = cy = S / 2
    # The mark is drawn smaller on adaptive icons, where Android crops to a circle and
    # anything outside the middle ~66% can be cut off.
    outer = S * 0.33 * scale
    inner = S * 0.215 * scale
    corner = S * 0.235  # ~23% is the squircle Android and iOS both land near

    import math

    for py in range(S):
        for px in range(S):
            x, y = px + 0.5, py + 0.5
            r = g = b = a = 0

            if background:
                if rounded_rect_alpha(x, y, S, corner) > 0:
                    r, g, b = gradient_at(x / S, y / S)
                    a = 255

            if mark:
                dx, dy = x - cx, y - cy
                dist = math.hypot(dx, dy)
                ang = math.degrees(math.atan2(dy, dx))  # -180..180, 0 = east

                # The C: a ring with a wedge removed on the right.
                in_ring = inner <= dist <= outer
                in_gap = -42 <= ang <= 42
                if in_ring and not in_gap:
                    r, g, b = mark_color
                    a = 255

                # A shipping container sitting in the gap - the detail that makes it a
                # freight mark rather than a plain letter.
                bw, bh = outer * 0.62, outer * 0.42
                bx0, bx1 = cx + outer * 0.02, cx + outer * 0.02 + bw
                by0, by1 = cy - bh / 2, cy + bh / 2
                if bx0 <= x <= bx1 and by0 <= y <= by1:
                    r, g, b = mark_color
                    a = 255
                    # Four thin ribs rather than two thick bars: two bars inside a white box
                    # reads as a pause button, which is not what a freight app should be.
                    for frac in (0.26, 0.42, 0.58, 0.74):
                        sx = bx0 + bw * frac
                        if abs(x - sx) <= bw * 0.030 and by0 + bh * 0.18 <= y <= by1 - bh * 0.18:
                            if background:
                                r, g, b = gradient_at(x / S, y / S)
                            else:
                                a = 0

            buf.append((r, g, b, a))

    small, w, h = downsample(buf, S, S, SS)
    return small, w, h


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    jobs = [
        # The main icon: gradient tile + white mark.
        ("icon.png", 1024, dict(background=True, mark=True)),
        ("splash-icon.png", 1024, dict(background=True, mark=True)),
        ("favicon.png", 64, dict(background=True, mark=True)),
        # Android adaptive: background and foreground are separate layers, and the
        # foreground must keep clear of the edges because the launcher crops it.
        ("android-icon-background.png", 1024, dict(background=True, mark=False)),
        ("android-icon-foreground.png", 1024, dict(background=False, mark=True, scale=0.68)),
        # Monochrome (themed icons on Android 13+): the silhouette only.
        ("android-icon-monochrome.png", 1024, dict(background=False, mark=True, scale=0.68)),
    ]

    for name, size, opts in jobs:
        pixels, w, h = render(size, **opts)
        write_png(OUT / name, pixels, w, h)
        print(f"  {name:<34} {w}x{h}  {(OUT / name).stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
