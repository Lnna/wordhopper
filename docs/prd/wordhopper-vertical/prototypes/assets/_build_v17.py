"""Build upright rear hamster sheet: soft transparency, straighten, bake ~20° left lean."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

GEN = Path(r"C:\Users\22793\.cursor\projects\d-Workspace-wordhopper\assets")
OUT = Path(__file__).resolve().parent
CELL = 192
# After straighten (head up), bake left lean (CCW = positive in PIL)
LEAN = 20.5


def soft_white_to_alpha(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # luminance near white → fade alpha (keep soft AA fringe)
            m = min(r, g, b)
            if m >= 250 and abs(r - g) < 6 and abs(g - b) < 6:
                px[x, y] = (r, g, b, 0)
            elif m >= 235 and abs(r - g) < 10 and abs(g - b) < 10:
                # soft edge: map 235..250 → alpha
                t = (250 - m) / 15.0
                px[x, y] = (r, g, b, max(0, min(a, int(a * t))))
    return im


def content_bbox(im: Image.Image, pad: int = 6):
    box = im.split()[-1].getbbox()
    if not box:
        return im
    x0, y0, x1, y1 = box
    return im.crop(
        (
            max(0, x0 - pad),
            max(0, y0 - pad),
            min(im.width, x1 + pad),
            min(im.height, y1 + pad),
        )
    )


def principal_angle_deg(im: Image.Image) -> float:
    """Rough body axis angle from vertical via alpha moments (degrees, CCW from +y up... use image y-down)."""
    import math

    a = im.split()[-1]
    w, h = a.size
    data = list(a.getdata())
    m00 = m10 = m01 = m20 = m02 = m11 = 0.0
    for i, v in enumerate(data):
        if v < 20:
            continue
        x = i % w
        y = i // w
        wgt = v / 255.0
        m00 += wgt
        m10 += wgt * x
        m01 += wgt * y
        m20 += wgt * x * x
        m02 += wgt * y * y
        m11 += wgt * x * y
    if m00 < 1:
        return 0.0
    cx, cy = m10 / m00, m01 / m00
    mu20 = m20 / m00 - cx * cx
    mu02 = m02 / m00 - cy * cy
    mu11 = m11 / m00 - cx * cy
    # angle of major axis (radians), image coords
    ang = 0.5 * math.atan2(2 * mu11, mu20 - mu02)
    # convert so 0 = vertical (along +y)
    deg = math.degrees(ang)
    # major axis often along body length; we want body vertical → rotate by -deg (+90 adjust)
    # In practice for rear runners elongated along diagonal, trial:
    return deg


def fit_cell(im: Image.Image, size: int = CELL) -> Image.Image:
    im = content_bbox(im)
    scale = min((size * 0.90) / im.width, (size * 0.90) / im.height)
    nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(im, ((size - nw) // 2, (size - nh) // 2 + 4), im)
    return out


def process_frame(path: Path, extra_straighten: float = 0.0) -> Image.Image:
    im = soft_white_to_alpha(Image.open(path))
    im = content_bbox(im)
    # Slim a bit to reduce "fat" silhouette
    im = im.resize((int(im.width * 0.88), im.height), Image.Resampling.LANCZOS)
    # Straighten toward upright then apply left lean.
    # Many gens lean forward/right ~35–50°; nudge CCW toward upright+left.
    rot = extra_straighten + LEAN
    im = im.rotate(rot, expand=True, resample=Image.Resampling.BICUBIC)
    return fit_cell(im)


def pack(frames: list[Image.Image], dest: Path) -> None:
    sheet = Image.new("RGBA", (CELL * len(frames), CELL), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * CELL, 0), fr)
    sheet.save(dest)
    print("wrote", dest, sheet.size)


def main():
    # Prefer newest upright gens; fall back to earlier rear frames
    sources = [
        GEN / "ham-upright-cute-f1.png",
        GEN / "ham-upright-cute-f2.png",
        GEN / "ham-upright-cute-f3.png",
        GEN / "ham-upright-cute-f1.png",
    ]
    # Per-frame straighten: f1 already fairly upright → small; f2 more diagonal → more CCW
    straighten = [5, 25, 10, 8]
    frames = []
    for p, s in zip(sources, straighten):
        if not p.exists():
            raise SystemExit(f"missing {p}")
        frames.append(process_frame(p, extra_straighten=s))
    pack(frames, OUT / "ham34v17.png")

    jp = GEN / "ham-upright-cute-jump.png"
    if jp.exists():
        fit = process_frame(jp, extra_straighten=12)
        fit.save(OUT / "ham34v17j.png")
        print("wrote", OUT / "ham34v17j.png")

    # Also produce a safer sheet from prior rear assets (ham-up-f*) with only lean, no big rotate
    up = [
        OUT / "ham-up-f1.png",
        OUT / "ham-up-f2.png",
        OUT / "ham-up-f3.png",
        OUT / "ham-up-f4.png",
    ]
    if all(p.exists() for p in up):
        safe = []
        for p in up:
            im = soft_white_to_alpha(Image.open(p))
            im = content_bbox(im)
            im = im.resize((int(im.width * 0.86), im.height), Image.Resampling.LANCZOS)
            # only small left lean — these are already upright rear
            im = im.rotate(LEAN, expand=True, resample=Image.Resampling.BICUBIC)
            safe.append(fit_cell(im))
        pack(safe, OUT / "ham34v17b.png")


if __name__ == "__main__":
    main()
