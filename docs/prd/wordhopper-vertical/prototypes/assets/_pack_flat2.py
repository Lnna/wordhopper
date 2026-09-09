from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

GEN = Path(r"C:\Users\22793\.cursor\projects\d-Workspace-wordhopper\assets")
OUT = Path(r"D:\Workspace\wordhopper\docs\prd\wordhopper-vertical\prototypes\assets")
CELL = 160


def soft_clear(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            mx, mn = max(r, g, b), min(r, g, b)
            if mn >= 245 and (mx - mn) < 12:
                px[x, y] = (r, g, b, 0)
            elif mn >= 228 and (mx - mn) < 18:
                t = (245 - mn) / 17.0
                px[x, y] = (r, g, b, max(0, min(a, int(a * t))))
    return im


def cel_flat(im: Image.Image) -> Image.Image:
    alpha = im.split()[-1]
    rgb = im.convert("RGB")
    rgb = ImageEnhance.Contrast(rgb).enhance(1.2)
    q = rgb.quantize(colors=16, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    flat = q.convert("RGB").filter(ImageFilter.MedianFilter(size=3))
    out = flat.convert("RGBA")
    a = alpha.point(lambda v: 0 if v < 40 else (255 if v > 130 else int((v - 40) * 255 / 90)))
    out.putalpha(a)
    return out


def fit_cell(im: Image.Image) -> Image.Image:
    box = im.split()[-1].getbbox()
    if not box:
        return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    im = im.crop(box)
    pad = 6
    canvas = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(im, (pad, pad), im)
    im = canvas
    scale = min((CELL * 0.90) / im.width, (CELL * 0.90) / im.height)
    nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    out.paste(im, ((CELL - nw) // 2, (CELL - nh) // 2 + 4), im)
    return out


def pack_row(src: Path, dest: Path, n: int = 4) -> None:
    im = soft_clear(Image.open(src))
    # light cel pass to kill leftover soft bands
    w, h = im.size
    cw = w // n
    frames = []
    for i in range(n):
        fr = cel_flat(im.crop((i * cw, 0, (i + 1) * cw, h)))
        frames.append(fit_cell(fr))
    sheet = Image.new("RGBA", (CELL * n, CELL), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * CELL, 0), fr)
    sheet.save(dest)
    print("wrote", dest, sheet.size)


def main() -> None:
    pack_row(GEN / "ham34-ultraflat-src.png", OUT / "ham34flat2.png")
    jp = GEN / "ham34v10-flat-jump-src.png"
    if (GEN / "ham34-ultraflat-jump.png").exists():
        jp = GEN / "ham34-ultraflat-jump.png"
    fit_cell(cel_flat(soft_clear(Image.open(jp)))).save(OUT / "ham34flat2j.png")
    print("wrote jump")


if __name__ == "__main__":
    main()
