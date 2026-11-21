#!/usr/bin/env python3
"""Generate favicon.ico, apple-touch-icon.png and og-image.png (needs Pillow).
Run from the repo root: python3 tools/make_icons.py
The mark is a simple price tag; it matches favicon.svg."""
from PIL import Image, ImageDraw, ImageFont

RUST, CREAM = (154, 74, 42), (247, 239, 230)
S = 8  # supersampling


def mark(size):
    k = size * S / 64
    img = Image.new("RGBA", (size * S, size * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, 64 * k - 1, 64 * k - 1], radius=14 * k, fill=RUST)
    pts = [(32, 9), (49, 24), (49, 52), (46, 55), (18, 55), (15, 52), (15, 24)]
    d.polygon([(x * k, y * k) for x, y in pts], fill=CREAM)
    d.ellipse([(32 - 4.5) * k, (24 - 4.5) * k, (32 + 4.5) * k, (24 + 4.5) * k], fill=RUST)
    d.rounded_rectangle([23 * k, 34 * k, 41 * k, 37.5 * k], radius=1.75 * k, fill=RUST)
    d.rounded_rectangle([23 * k, 42 * k, 35 * k, 45.5 * k], radius=1.75 * k, fill=RUST)
    return img.resize((size, size), Image.LANCZOS)


def font(bold, size):
    names = (["DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf"] if bold
             else ["DejaVuSans.ttf", "LiberationSans-Regular.ttf"])
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            pass
    return ImageFont.load_default()


def main():
    mark(256).save("favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    # full-bleed touch icon: iOS applies its own rounding, so no rounded corners here
    k = 180 / 64
    pts = [(32, 9), (49, 24), (49, 52), (46, 55), (18, 55), (15, 52), (15, 24)]
    big = Image.new("RGB", (180 * S, 180 * S), RUST)
    bd = ImageDraw.Draw(big)
    kk = k * S
    bd.polygon([(x * kk, y * kk) for x, y in pts], fill=CREAM)
    bd.ellipse([(32 - 4.5) * kk, (24 - 4.5) * kk, (32 + 4.5) * kk, (24 + 4.5) * kk], fill=RUST)
    bd.rounded_rectangle([23 * kk, 34 * kk, 41 * kk, 37.5 * kk], radius=1.75 * kk, fill=RUST)
    bd.rounded_rectangle([23 * kk, 42 * kk, 35 * kk, 45.5 * kk], radius=1.75 * kk, fill=RUST)
    big.resize((180, 180), Image.LANCZOS).save("apple-touch-icon.png")

    og = Image.new("RGB", (1200, 630), (245, 245, 247))
    d = ImageDraw.Draw(og)
    og.paste(mark(200), (90, 110), mark(200))
    d.text((90, 350), "RDR2 Hunting Prices", font=font(True, 84), fill=(29, 29, 31))
    d.text((90, 460), "Butcher and trapper values, story mode", font=font(False, 40), fill=(110, 110, 115))
    d.text((90, 530), "Free. No ads. 31 animals.", font=font(False, 32), fill=RUST)
    og.save("og-image.png", optimize=True)


if __name__ == "__main__":
    main()
