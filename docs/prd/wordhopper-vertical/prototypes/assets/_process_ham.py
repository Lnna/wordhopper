"""Process hamster sheets: transparency, lean, slim, pack frames."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent
CELL = 160
EXTRA_LEAN = -10  # degrees; negative = CCW / left
SLIM_X = 0.86


def to_rgba(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    # flood-ish: treat near-white / checkerboard-ish corners as transparent
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            # white / light gray bg
            if r > 245 and g > 245 and b > 245:
                px[x, y] = (r, g, b, 0)
            elif r > 230 and g > 230 and b > 230 and abs(r - g) < 8 and abs(g - b) < 8:
                # soft fringe
                fade = int(a * (255 - min(r, g, b)) / 25)
                px[x, y] = (r, g, b, max(0, min(a, fade)))
    return im


def bbox_content(im: Image.Image, pad: int = 4) -> Image.Image:
    alpha = im.split()[-1]
    box = alpha.getbbox()
    if not box:
        return im
    x0, y0, x1, y1 = box
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(im.width, x1 + pad)
    y1 = min(im.height, y1 + pad)
    return im.crop((x0, y0, x1, y1))


def lean_slim(im: Image.Image, lean: float = EXTRA_LEAN, slim: float = SLIM_X) -> Image.Image:
    im = bbox_content(im)
    # slim horizontally around center
    nw = max(1, int(im.width * slim))
    im = im.resize((nw, im.height), Image.Resampling.LANCZOS)
    # rotate with expanded canvas; keep AA
    im = im.rotate(lean, expand=True, resample=Image.Resampling.BICUBIC)
    return bbox_content(im, pad=2)


def fit_cell(im: Image.Image, size: int = CELL) -> Image.Image:
    im = bbox_content(im)
    scale = min((size * 0.90) / im.width, (size * 0.90) / im.height)
    nw = max(1, int(im.width * scale))
    nh = max(1, int(im.height * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(im, ((size - nw) // 2, (size - nh) // 2), im)
    return canvas


def split_row(im: Image.Image, n: int = 4) -> list[Image.Image]:
    im = to_rgba(im)
    w, h = im.size
    cw = w // n
    frames = []
    for i in range(n):
        frames.append(im.crop((i * cw, 0, (i + 1) * cw, h)))
    return frames


def pack(frames: list[Image.Image], path: Path) -> None:
    sheet = Image.new("RGBA", (CELL * len(frames), CELL), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * CELL, 0), fr)
    sheet.save(path)
    print("wrote", path, sheet.size)


def process_sheet(src: Path, dest: Path, lean: float = EXTRA_LEAN) -> None:
    frames = [fit_cell(lean_slim(f, lean=lean)) for f in split_row(Image.open(src), 4)]
    pack(frames, dest)


def process_single(src: Path, dest: Path, lean: float = EXTRA_LEAN) -> None:
    im = to_rgba(Image.open(src))
    # if image has road/bg, try remove near-white only; also drop very light gray road if needed
    out = fit_cell(lean_slim(im, lean=lean))
    out.save(dest)
    print("wrote", dest, out.size)


def process_existing_v10() -> None:
    """Extra -10° lean + slim on current rear sheets."""
    src = OUT / "ham34v10.png"
    jump = OUT / "ham34v10j.png"
    frames = []
    im = Image.open(src).convert("RGBA")
    for i in range(4):
        fr = im.crop((i * 256, 0, (i + 1) * 256, 256))
        # v10 already has some lean; add extra left lean + slim
        frames.append(fit_cell(lean_slim(fr, lean=EXTRA_LEAN, slim=SLIM_X)))
    pack(frames, OUT / "ham34v11.png")

    j = Image.open(jump).convert("RGBA")
    fit_cell(lean_slim(j, lean=EXTRA_LEAN, slim=SLIM_X)).save(OUT / "ham34v11j.png")
    print("wrote", OUT / "ham34v11j.png")


if __name__ == "__main__":
    gen = Path(r"C:\Users\22793\.cursor\projects\d-Workspace-wordhopper\assets")
    # Prefer cute rear sheet if present
    rear = gen / "ham34cute-rear-run.png"
    if rear.exists():
        # cute sheet is more upright side/iso — apply stronger lean (~20°) toward left
        process_sheet(rear, OUT / "ham34v12.png", lean=-20)
    cute = gen / "ham34cute-run.png"
    if cute.exists():
        process_sheet(cute, OUT / "ham34v12b.png", lean=-20)

    for name, outn in [
        ("ham34cute-rear-jump.png", "ham34v12j.png"),
        ("ham34cute-jump.png", "ham34v12bj.png"),
    ]:
        p = gen / name
        if p.exists():
            process_single(p, OUT / outn, lean=-20)

    process_existing_v10()
