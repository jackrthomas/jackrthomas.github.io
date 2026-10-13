"""Fourier-series (epicycle) animation of the outline of a bold "404".

The digits are drawn with negative letter spacing so they overlap into a single
connected shape; only its OUTER outline is approximated (the holes are drawn in
gray but not fitted). The
outline z(t), t in [0,1), is sampled uniformly by arc length, and its Fourier
coefficients c_j are computed with an FFT. Frames show the partial sums
    S_N(t) = sum_{|j| <= N} c_j exp(2 pi i j t)
for increasing N: target outline (and holes) in gray, S_N in black, the chain of
epicycles (one circle per term, radius |c_j|) in the site maroon, and the formula for S_N
with its coefficients to 2 decimal places underneath.

usage (from the project root):
    python3 _tools/fourier404.py images/404-fourier.gif [--preview preview.png]
"""
import sys
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
import io
import matplotlib
matplotlib.use("Agg")
from matplotlib import font_manager, mathtext

OUT = sys.argv[1]
PREVIEW = sys.argv[sys.argv.index("--preview") + 1] if "--preview" in sys.argv else None

# ---------------------------------------------------------------- the shape --
FONT = font_manager.findfont(font_manager.FontProperties(family="DejaVu Sans", weight="bold"))
SIZE = 400
font = ImageFont.truetype(FONT, SIZE)
TRACK = -0.20 * SIZE                    # negative letter spacing: digits overlap

canvas = Image.new("L", (int(SIZE * 3.2), int(SIZE * 1.5)), 0)
d = ImageDraw.Draw(canvas)
x = 0.1 * SIZE
for ch in "404":
    d.text((x, 0.1 * SIZE), ch, font=font, fill=255)
    x += font.getlength(ch) + TRACK
mask = np.array(canvas)
# close any hairline gaps where the digits meet, so the union is one blob
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
# two-level contours: outer outlines and the holes inside them
contours, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
hier = hier[0]
outer_idx = max((i for i in range(len(contours)) if hier[i][3] == -1),
                key=lambda i: cv2.contourArea(contours[i]))
contour = contours[outer_idx][:, 0, :].astype(float)
holes = [contours[i][:, 0, :].astype(float) for i in range(len(contours)) if hier[i][3] == outer_idx]
print("outer outline:", len(contour), "points; holes:", len(holes))

# complex curve, y up, centred; the holes get exactly the same transform
def to_complex(pts):
    return pts[:, 0] - 1j * pts[:, 1]
z = to_complex(contour)
SHIFT = z.mean()
NORM = np.abs(z - SHIFT).max()
z = (z - SHIFT) / NORM
holes_z = [(to_complex(h) - SHIFT) / NORM for h in holes]

# resample uniformly by arc length
M = 2048
seg = np.abs(np.diff(np.append(z, z[0])))
s = np.concatenate([[0], np.cumsum(seg)])
t_new = np.linspace(0, s[-1], M, endpoint=False)
zc = np.append(z, z[0])
z = np.interp(t_new, s, zc.real) + 1j * np.interp(t_new, s, zc.imag)

# ------------------------------------------------------ Fourier coefficients --
c = np.fft.fft(z) / M                    # c[k] multiplies exp(2 pi i k t), k mod M
def coef(j):
    return c[j % M]

def partial_sum(N, t):
    js = np.arange(-N, N + 1)
    return (coef(js)[None, :] * np.exp(2j * np.pi * np.outer(t, js))).sum(axis=1)

# -------------------------------------------------------------- rendering ----
W, H = 720, 420                          # picture area
EXPR_H = 190                             # formula panel underneath
PAD = 14
xs, ys = z.real, z.imag
# The epicycle chain reaches well outside the letters, so fit the scale to the
# furthest any circle in the chain gets (in x and in y) over a full sweep.
def chain_extent(N=100, samples=400):
    js = sorted(range(-N, N + 1), key=lambda j: -abs(coef(j)) if j else np.inf)
    js = [0] + [j for j in js if j != 0]
    ex = ey = 0.0
    for t in np.linspace(0, 1, samples, endpoint=False):
        pos = 0j
        for j in js:
            r = abs(coef(j)) if j else 0.0
            ex = max(ex, abs(pos.real) + r); ey = max(ey, abs(pos.imag) + r)
            pos += coef(j) * np.exp(2j * np.pi * j * t)
    return ex, ey
ex, ey = chain_extent(N=404)
scale = min((W / 2 - PAD) / ex, (H / 2 - PAD) / ey)
cx, cy = W / 2, H / 2
def px(w):
    return np.stack([cx + scale * w.real, cy - scale * w.imag], axis=-1)

GRAY, BLACK = (175, 175, 175), (0, 0, 0)
RED = (112, 0, 56)                       # the site maroon (#700038) for the epicycles
target_pts = [tuple(p) for p in px(z)]
hole_pts = [[tuple(p) for p in px(h)] for h in holes_z]
LABEL_FONT = ImageFont.truetype(FONT, 15)
# the "N = ..." label sits in the middle of the 0's hole (the hole nearest the centre)
zero_hole = min(holes_z, key=lambda h: abs(h.mean().real))
(LABEL_X, LABEL_Y), = px(np.array([zero_hole.mean()]))
SS = 2                                   # supersampling for smooth lines

# ---------------------------------------------------------- formula panel ----
# S_N(t) = c_0 + c_1 e^{2 pi i t} + c_{-1} e^{-2 pi i t} + ... (coefficients to
# 2 decimal places), typeset with matplotlib's mathtext, flowed into lines.
MATH_PT, MATH_DPI = 8, 100
_cache = {}
def math_img(tex):
    if tex not in _cache:
        buf = io.BytesIO()
        mathtext.math_to_image(tex, buf, prop=font_manager.FontProperties(size=MATH_PT),
                               dpi=MATH_DPI, format="png")
        buf.seek(0)
        _cache[tex] = Image.open(buf).convert("RGBA")
    return _cache[tex]

def num(v):
    v = round(v, 2) + 0.0                # +0.0 turns -0.0 into 0.0
    return f"{v:.2f}"
def cnum(w):
    im = round(w.imag, 2) + 0.0
    return f"({num(w.real)}{'-' if im < 0 else '+'}{num(abs(im))}i)"
def term_tex(j, first=False):
    if j == 0:
        return "$" + cnum(coef(0)) + "$"
    e = r"2\pi i t" if abs(j) == 1 else rf"{2 * abs(j)}\pi i t"   # e.g. e^{6 pi i t}
    e = ("-" if j < 0 else "") + e
    return "$" + ("" if first else "+") + rf"{cnum(coef(j))}\,e^{{{e}}}" + "$"

def expr_panel(N):
    panel = Image.new("RGB", (W, EXPR_H), "white")
    order = [0] + [j for k in range(1, N + 1) for j in (k, -k)]
    tokens = [rf"$S_{{{N}}}(t)\;=\;$"] + [term_tex(j, first=(i == 0)) for i, j in enumerate(order)]
    x, y, line_h, gap = PAD, 6, 0, 4
    lines_max_y = EXPR_H - 8
    for i, tok in enumerate(tokens):
        im = math_img(tok)
        if x + im.width > W - PAD:       # wrap
            x, y = PAD + 18, y + line_h + 3
            line_h = 0
        rest = len(tokens) - i
        more = math_img(rf"$+\;\cdots\;\mathrm{{({rest}\ more\ terms)}}$")
        # stop early if this token (plus the "more" note) would not fit
        if y + max(im.height, more.height) > lines_max_y or \
           (y + 2 * im.height + 3 > lines_max_y and x + im.width + more.width > W - PAD):
            panel.paste(more, (int(x), int(y)), more)
            break
        panel.paste(im, (int(x), int(y)), im)
        x += im.width + gap
        line_h = max(line_h, im.height)
    return panel

def frame(N, t_pen, trace_t=None):
    im = Image.new("RGB", (W * SS, H * SS), "white")
    dr = ImageDraw.Draw(im)
    def P(pts):
        return [(x * SS, y * SS) for x, y in pts]
    # target outline (gray)
    dr.line(P(target_pts + [target_pts[0]]), fill=GRAY, width=2 * SS, joint="curve")
    for hp in hole_pts:                  # holes: shown, not approximated
        dr.line(P(hp + [hp[0]]), fill=GRAY, width=2 * SS, joint="curve")
    # partial sum S_N (black)
    tt = np.linspace(0, 1, 900, endpoint=False) if trace_t is None else trace_t
    curve = [tuple(p) for p in px(partial_sum(N, tt))]
    if trace_t is None:
        curve.append(curve[0])
    if len(curve) > 1:
        dr.line(P(curve), fill=BLACK, width=3 * SS + 1, joint="curve")   # thicker trace
    # epicycles (red): centre term first, then +1,-1,+2,-2,... ordered by size
    js = sorted(range(-N, N + 1), key=lambda j: -abs(coef(j)) if j else np.inf)
    js = [0] + [j for j in js if j != 0]
    pos = 0j
    for j in js:
        term = coef(j) * np.exp(2j * np.pi * j * t_pen)
        if j != 0:
            r = abs(coef(j)) * scale
            (x0, y0), = px(np.array([pos]))
            if r > 0.6:
                dr.ellipse([(x0 - r) * SS, (y0 - r) * SS, (x0 + r) * SS, (y0 + r) * SS],
                           outline=RED, width=SS)
            (x1, y1), = px(np.array([pos + term]))
            dr.line([(x0 * SS, y0 * SS), (x1 * SS, y1 * SS)], fill=RED, width=SS)
        pos += term
    (xp, yp), = px(np.array([pos]))
    dr.ellipse([(xp - 3.5) * SS, (yp - 3.5) * SS, (xp + 3.5) * SS, (yp + 3.5) * SS], fill=RED)
    im = im.resize((W, H), Image.LANCZOS)
    ImageDraw.Draw(im).multiline_text((LABEL_X, LABEL_Y), f"N =\n{N}", font=LABEL_FONT,
                                      fill=(0, 0, 0), anchor="mm", align="center", spacing=2)
    if N not in PANELS:
        PANELS[N] = expr_panel(N)
    full = Image.new("RGB", (W, H + EXPR_H), "white")
    full.paste(im, (0, 0))
    full.paste(PANELS[N], (0, H))
    return full

PANELS = {}

if PREVIEW:
    frame(25, 0.3).save(PREVIEW)
    sys.exit()

# -------------------------------------------------------------- animation ----
frames, durations = [], []
Ns = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 70, 100, 404]
for k, N in enumerate(Ns):
    # the pen sweeps once round the curve for each N, tracing S_N as it goes
    steps = 18
    for i in range(1, steps + 1):
        t = i / steps
        frames.append(frame(N, t % 1.0, trace_t=np.linspace(0, t, max(2, int(900 * t)))))
        durations.append(45)             # constant speed: no pauses between cycles
durations[-1] = 3000                     # ...except a pause on the final N = 404 curve

# one shared palette (from the last frame: white, gray, black, reds) so colours
# stay identical across frames -- per-frame palettes tinted the black label red
shared = frames[-1].quantize(colors=48, method=Image.MEDIANCUT)
pal = [f.quantize(palette=shared, dither=Image.Dither.NONE) for f in frames]
# snap near-white palette entries to pure white so the GIF blends into the page
for f in pal:
    pl = f.getpalette()
    for i in range(0, len(pl), 3):
        if min(pl[i:i + 3]) >= 240:
            pl[i:i + 3] = [255, 255, 255]
    f.putpalette(pl)
pal[0].save(OUT, save_all=True, append_images=pal[1:], duration=durations, loop=0,
            optimize=True, disposal=1)
print(len(frames), "frames ->", OUT)
