"""Draw cute rear-3/4 hamster matching original palette; bake lean."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent
CELL = 160
LEAN = -20.5  # CCW degrees ≈ roadside + user +10°


def round_ellipse(draw, xy, fill, outline=None, width=2):
    draw.ellipse(xy, fill=fill, outline=outline, width=width if outline else 0)


def draw_hamster(pose: int, jump: bool = False) -> Image.Image:
    """pose 0..3 run cycle. Coordinates in upright space before lean."""
    W, H = 220, 220
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # Original-ish palette
    FUR = (245, 228, 196, 255)
    FUR_D = (232, 200, 160, 255)
    EAR = (244, 180, 150, 255)
    BLUSH = (255, 170, 150, 200)
    EYE = (30, 28, 35, 255)
    SCARF = (70, 165, 230, 255)
    SCARF_D = (45, 130, 200, 255)
    PAW = (250, 200, 170, 255)
    LINE = (90, 70, 55, 255)
    BELLY = (252, 240, 220, 255)

    cx, cy = 110, 115
    # compact dumpling body (not pear-fat)
    bw, bh = 78, 86
    if jump:
        cy -= 8
        bh = 80

    # leg offsets by pose (rear view: left/right from viewer)
    # pose: alternate lift
    lifts = [
        (0, 10, 8, 0),   # L downish, R up
        (6, 2, 2, 8),
        (10, 0, 0, 10),
        (2, 8, 8, 2),
    ]
    ll, lr, rl, rr = lifts[pose % 4]
    if jump:
        ll, lr, rl, rr = 14, -4, 14, -4

    # back legs
    d.ellipse([cx - 28, cy + 28 + ll, cx - 8, cy + 52 + ll], fill=PAW, outline=LINE, width=2)
    d.ellipse([cx + 8, cy + 28 + rl, cx + 28, cy + 52 + rl], fill=PAW, outline=LINE, width=2)
    # front paws (smaller, higher)
    d.ellipse([cx - 34, cy + 8 + lr, cx - 18, cy + 24 + lr], fill=PAW, outline=LINE, width=2)
    d.ellipse([cx + 18, cy + 8 + rr, cx + 34, cy + 24 + rr], fill=PAW, outline=LINE, width=2)

    # body
    d.ellipse([cx - bw // 2, cy - bh // 2, cx + bw // 2, cy + bh // 2], fill=FUR, outline=LINE, width=3)
    # soft belly oval (smaller → less fat look)
    d.ellipse([cx - 22, cy - 6, cx + 22, cy + 34], fill=BELLY)

    # tail nub
    d.ellipse([cx - 8, cy + 30, cx + 8, cy + 46], fill=(255, 250, 240, 255), outline=LINE, width=2)

    # ears (from behind, both visible)
    d.ellipse([cx - 36, cy - 78, cx - 10, cy - 48], fill=FUR, outline=LINE, width=2)
    d.ellipse([cx + 10, cy - 78, cx + 36, cy - 48], fill=FUR, outline=LINE, width=2)
    d.ellipse([cx - 30, cy - 72, cx - 16, cy - 54], fill=EAR)
    d.ellipse([cx + 16, cy - 72, cx + 30, cy - 54], fill=EAR)

    # head (slightly overlapping body)
    d.ellipse([cx - 40, cy - 70, cx + 40, cy - 5], fill=FUR, outline=LINE, width=3)
    # head highlight
    d.ellipse([cx - 18, cy - 62, cx + 6, cy - 42], fill=(255, 248, 235, 180))

    # scarf (around neck, knot slightly left-back)
    d.ellipse([cx - 28, cy - 18, cx + 28, cy + 8], fill=SCARF, outline=SCARF_D, width=2)
    # flutter ends
    flutter = [(cx - 48, cy - 8), (cx - 62, cy + 6), (cx - 40, cy + 4)]
    d.polygon(flutter, fill=SCARF, outline=SCARF_D)
    flutter2 = [(cx - 42, cy - 2), (cx - 58, cy + 16), (cx - 36, cy + 10)]
    d.polygon(flutter2, fill=SCARF_D)

    # 3/4 peek: right cheek + eye (cute, not leering)
    d.ellipse([cx + 12, cy - 42, cx + 34, cy - 18], fill=BLUSH)
    # big shiny eye
    d.ellipse([cx + 16, cy - 48, cx + 36, cy - 26], fill=EYE)
    d.ellipse([cx + 20, cy - 45, cx + 26, cy - 39], fill=(255, 255, 255, 255))
    d.ellipse([cx + 28, cy - 36, cx + 31, cy - 33], fill=(255, 255, 255, 220))
    # tiny smile curve on cheek side
    d.arc([cx + 18, cy - 28, cx + 32, cy - 14], 20, 140, fill=LINE, width=2)

    # left ear tip shade
    d.ellipse([cx - 34, cy - 70, cx - 22, cy - 58], fill=FUR_D)

    return im


def bake(im: Image.Image, lean: float = LEAN) -> Image.Image:
    # slight slim
    slim_w = int(im.width * 0.90)
    im = im.resize((slim_w, im.height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (im.width + 40, im.height + 40), (0, 0, 0, 0))
    canvas.paste(im, (20, 20), im)
    rot = canvas.rotate(lean, expand=True, resample=Image.Resampling.BICUBIC)
    # crop to content
    box = rot.split()[-1].getbbox()
    if box:
        rot = rot.crop(box)
    # fit cell
    scale = min((CELL * 0.92) / rot.width, (CELL * 0.92) / rot.height)
    nw, nh = max(1, int(rot.width * scale)), max(1, int(rot.height * scale))
    rot = rot.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    out.paste(rot, ((CELL - nw) // 2, (CELL - nh) // 2), rot)
    return out


def main():
    frames = [bake(draw_hamster(i)) for i in range(4)]
    sheet = Image.new("RGBA", (CELL * 4, CELL), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * CELL, 0), fr)
    run_path = OUT / "ham34v14.png"
    sheet.save(run_path)
    print("wrote", run_path)

    jump = bake(draw_hamster(1, jump=True))
    jp = OUT / "ham34v14j.png"
    jump.save(jp)
    print("wrote", jp)


if __name__ == "__main__":
    main()
