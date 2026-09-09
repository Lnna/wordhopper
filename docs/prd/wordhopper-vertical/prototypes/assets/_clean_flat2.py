"""Re-pack flat hamster with aggressive background kill (no checker / parallelogram ghost)."""
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

GEN = Path(r"C:\Users\22793\.cursor\projects\d-Workspace-wordhopper\assets")
OUT = Path(__file__).resolve().parent
CELL = 160


def kill_bg(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size

    def is_bg(r, g, b, a):
        if a < 8:
            return True
        mx, mn = max(r, g, b), min(r, g, b)
        # white / near-white
        if mn >= 235 and (mx - mn) < 20:
            return True
        # light gray / checker light cell
        if mn >= 190 and (mx - mn) < 18:
            return True
        # mid gray checker dark cell
        if 110 <= mn <= 190 and (mx - mn) < 22 and abs(r - 128) < 70:
            # but keep blue scarf (blue channel dominates)
            if b > r + 25 and b > g + 15:
                return False
            # keep warm fur (r/g higher)
            if r > 200 and g > 170 and b < 180:
                return False
            return True
        # pale checker fringe
        if mn >= 160 and (mx - mn) < 30 and a < 220:
            if not (b > r + 20 or (r > 200 and g > 160)):
                return True
        return False

    # pass 1: mark bg
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_bg(r, g, b, a):
                px[x, y] = (0, 0, 0, 0)

    # pass 2: flood from borders — any leftover near-neutral connected to edge
    from collections import deque

    visited = [[False] * w for _ in range(h)]
    q = deque()

    def edge_seed(x, y):
        r, g, b, a = px[x, y]
        if a == 0:
            return True
        mx, mn = max(r, g, b), min(r, g, b)
        # neutral-ish leftover
        return (mx - mn) < 35 and mn > 100 and not (b > r + 30)

    for x in range(w):
        for y in (0, h - 1):
            if edge_seed(x, y):
                q.append((x, y))
                visited[y][x] = True
    for y in range(h):
        for x in (0, w - 1):
            if edge_seed(x, y) and not visited[y][x]:
                q.append((x, y))
                visited[y][x] = True

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                if edge_seed(nx, ny):
                    visited[ny][nx] = True
                    q.append((nx, ny))

    # pass 3: kill isolated low-alpha speckles
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if 0 < a < 90:
                px[x, y] = (0, 0, 0, 0)
            elif a > 0 and a < 200:
                # harden remaining fringe toward opaque or gone
                mx, mn = max(r, g, b), min(r, g, b)
                if (mx - mn) < 25 and mn > 140:
                    px[x, y] = (0, 0, 0, 0)
                else:
                    px[x, y] = (r, g, b, 255)

    return im


def cel_flat(im: Image.Image) -> Image.Image:
    alpha = im.split()[-1]
    rgb = ImageEnhance.Contrast(im.convert("RGB")).enhance(1.15)
    q = rgb.quantize(colors=20, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    flat = q.convert("RGB").filter(ImageFilter.MedianFilter(size=3))
    out = flat.convert("RGBA")
    # keep hard alpha from kill_bg
    a = alpha.point(lambda v: 255 if v >= 90 else 0)
    out.putalpha(a)
    return out


def fit_cell(im: Image.Image) -> Image.Image:
    box = im.split()[-1].getbbox()
    if not box:
        return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    im = im.crop(box)
    pad = 4
    canvas = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(im, (pad, pad), im)
    scale = min((CELL * 0.90) / canvas.width, (CELL * 0.90) / canvas.height)
    nw, nh = max(1, int(canvas.width * scale)), max(1, int(canvas.height * scale))
    canvas = canvas.resize((nw, nh), Image.Resampling.LANCZOS)
    # re-harden alpha after resize
    px = canvas.load()
    for y in range(nh):
        for x in range(nw):
            r, g, b, a = px[x, y]
            if a < 100:
                px[x, y] = (0, 0, 0, 0)
            elif a < 255:
                px[x, y] = (r, g, b, 255)
    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    out.paste(canvas, ((CELL - nw) // 2, (CELL - nh) // 2 + 4), canvas)
    return out


def main() -> None:
    src = kill_bg(Image.open(GEN / "ham34-ultraflat-src.png"))
    w, h = src.size
    cw = w // 4
    frames = []
    for i in range(4):
        fr = cel_flat(src.crop((i * cw, 0, (i + 1) * cw, h)))
        frames.append(fit_cell(fr))
    sheet = Image.new("RGBA", (CELL * 4, CELL), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * CELL, 0), fr)
    sheet.save(OUT / "ham34flat2.png")
    print("run", sheet.size)

    jp = kill_bg(Image.open(GEN / "ham34-ultraflat-jump.png"))
    fit_cell(cel_flat(jp)).save(OUT / "ham34flat2j.png")
    print("jump ok")


if __name__ == "__main__":
    main()
