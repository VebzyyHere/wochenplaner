# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw

INK   = (46, 42, 69)
PAPER = (250, 250, 252)
BARS  = [(104, 158, 235), (172, 130, 228), (60, 172, 126)]

def zeichne(size, maskable=False):
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, S, S], fill=INK)
        pad = S * 0.28
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=INK)
        pad = S * 0.21

    innen = S - 2 * pad
    spalten = 4
    luecke = innen * 0.075
    breite = (innen - luecke * (spalten - 1)) / spalten
    radius = breite * 0.34

    # Vier Spalten, drei gefuellt, eine frei: unverplante Zeit gehoert dazu.
    bloecke = [(0, 0.00, 0.52, 0), (1, 0.30, 0.70, 1), (3, 0.16, 0.44, 2)]
    for spalte, rel_y, rel_h, farbe in bloecke:
        x = pad + spalte * (breite + luecke)
        y = pad + innen * rel_y
        h = innen * rel_h
        d.rounded_rectangle([x, y, x + breite, y + h], radius=radius, fill=BARS[farbe])

    # Die freie Spalte als angedeuteter Umriss — sie ist Teil des Plans.
    x = pad + 2 * (breite + luecke)
    d.rounded_rectangle([x, pad + innen * 0.62, x + breite, pad + innen * 0.98],
                        radius=radius, outline=PAPER + (70,), width=int(S * 0.012))
    return img.resize((size, size), Image.LANCZOS)

for s in (192, 512):
    zeichne(s).save("pwa/icon-%d.png" % s)
zeichne(512, maskable=True).save("pwa/icon-maskable-512.png")
zeichne(180).save("pwa/apple-touch-icon.png")
# Vorschau in Kleinstgroesse, um Lesbarkeit zu pruefen
zeichne(512).resize((64, 64), Image.LANCZOS).resize((256, 256), Image.NEAREST).save("pwa/probe-64.png")
print("ok")
