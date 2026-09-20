"""
Builds the hero artwork: assets/art/hero-capacity.svg

The reference export carried a candlestick chart here. BRUT rents GPUs, so the
same slot carries a rack occupancy chart instead: each block is one job holding
a share of the rack between two hours. Grid, palette, block rhythm and the
960.4 x 1195.6 box are all kept from the reference so the hero composition,
the route line drawn over it and the scroll motion are unaffected.

Green blocks are completed jobs, violet blocks are still running, matching the
verification accents in css/brut.css.

    python tools/make-hero-chart.py
"""
from pathlib import Path

W, H = 1195.6, 960.4
LINE = "#4D5566"       # grid, as in the reference
DONE = "#24FFA7"       # completed job
LIVE = "#AB55FF"       # running job

AXIS_X = 38.0          # vertical axis sits here in the reference
GRID_Y = [768.2, 624.5, 480.8, 337.1, 193.4, 49.7]
GRID_T = 4.312         # grid line thickness, measured off the reference

# (left, top, bottom, colour). Blocks float between two hours, so no stems.
BLOCKS = [
    (110, 600, 850, DONE),
    (206, 460, 800, LIVE),
    (302, 445, 745, DONE),
    (398, 380, 700, LIVE),
    (494, 360, 660, DONE),
    (590, 260, 620, DONE),
    (686, 325, 575, LIVE),
    (782, 265, 535, DONE),
    (878, 225, 495, LIVE),
    (974, 170, 460, DONE),
    (1070, 170, 420, DONE),
]
BLOCK_W = 78.0
TICK_W = 26.0          # brighter stub at the left end of each grid line


def rr(x, y, w, h, r, fill, opacity=None):
    o = f' opacity="{opacity}"' if opacity is not None else ""
    return (f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" '
            f'rx="{r:.2f}" fill="{fill}"{o}/>')


def build():
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
        f'width="{W}" height="{H}" preserveAspectRatio="none" fill="none">',
        '<title>GPU rack occupancy</title>',
        '<g id="grid">',
    ]
    r = GRID_T / 2
    for y in GRID_Y:
        out.append(rr(AXIS_X, y - r, W - 10.1 - AXIS_X, GRID_T, r, LINE, 0.45))
        out.append(rr(AXIS_X, y - r, TICK_W, GRID_T, r, LINE))
    out.append(rr(AXIS_X - GRID_T, 40.0, GRID_T, 868.0, r, LINE, 0.6))
    out.append('</g>')

    out.append('<g id="jobs">')
    for x, top, bottom, colour in BLOCKS:
        out.append(rr(x, top, BLOCK_W, bottom - top, BLOCK_W / 2, colour))
    out.append('</g>')

    out.append('</svg>')
    return "\n".join(out) + "\n"


path = Path("assets/art/hero-capacity.svg")
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(build(), encoding="utf-8")
print(f"{path}: {path.stat().st_size} bytes")
