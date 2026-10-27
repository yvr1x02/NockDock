"""Genera le animazioni del personaggio a partire dal GIF originale (pixel art 2x)."""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageSequence

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

FW, FH = 48, 64          # dimensione di un fotogramma (pixel nativi)
X0, Y0 = 25, 8           # origine del ritaglio nel fotogramma nativo 96x96

# ---- fotogrammi originali a risoluzione nativa ----
orig = [np.array(f.convert('RGBA'))[::2, ::2] for f in ImageSequence.Iterator(Image.open(SRC))]
crop = lambda a: a[Y0:Y0 + FH, X0:X0 + FW].copy()
base = [crop(a) for a in orig]
FRONT, THREE_Q, SIDE, SLEEPY = base[7], base[0], base[1], base[13]

OUTLINE = (4, 6, 27, 255)
SKIN = (250, 211, 192, 255)
LID = (92, 39, 38, 255)


def blank():
    return np.zeros((FH, FW, 4), dtype=np.uint8)


def shift(a, dx=0, dy=0):
    out = blank()
    h, w = a.shape[:2]
    ys, yd = (slice(max(0, -dy), min(h, h - dy)), slice(max(0, dy), min(h, h + dy)))
    xs, xd = (slice(max(0, -dx), min(w, w - dx)), slice(max(0, dx), min(w, w + dx)))
    out[yd, xd] = a[ys, xs]
    return out


def over(dst, src):
    m = src[..., 3] > 0
    dst[m] = src[m]
    return dst


def is_eye(p):
    r, g, b, a = (int(v) for v in p)
    return a and ((b > r + 25 and b > 90) or (r > 235 and g > 235 and b > 235))


def eye_pixels(a):
    # solo nella fascia degli occhi (sopra il cappuccio)
    return [(x, y) for y in range(26, 34) for x in range(FW) if is_eye(a[y, x])]


def skin_color(a):
    pix = [tuple(a[y, x]) for y in range(28, 36) for x in range(FW)
           if a[y, x, 3] and a[y, x, 0] > 225 and 170 < a[y, x, 1] < 225 and 140 < a[y, x, 2] < 210]
    return max(set(pix), key=pix.count) if pix else SKIN


def blink(a):
    out = a.copy()
    pts = eye_pixels(a)
    if not pts:
        return out
    skin = skin_color(a)
    bottom = max(y for _, y in pts)
    for x, y in pts:
        out[y, x] = skin
    for x in sorted({x for x, _ in pts}):
        out[bottom, x] = LID
        if out[bottom - 2, x, 3] and not is_eye(a[bottom - 2, x]):
            out[bottom - 2, x] = skin   # toglie la riga scura sopra l'occhio
    return out


def breathe(a, split=44):
    """Abbassa testa e busto di 1 pixel (espirazione)."""
    out = a.copy()
    top = a[:split].copy()
    out[1:split + 1] = np.where(top[..., 3:4] > 0, top, out[1:split + 1])
    out[0] = 0
    return out


def glyph(rows, color, outline=OUTLINE):
    h, w = len(rows), len(rows[0])
    g = np.zeros((h + 2, w + 2, 4), dtype=np.uint8)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c == '1':
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if outline and g[y + 1 + dy, x + 1 + dx, 3] == 0:
                            g[y + 1 + dy, x + 1 + dx] = outline
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c == '1':
                g[y + 1, x + 1] = color
    return g


def stamp(a, g, x, y):
    out = a.copy()
    h, w = g.shape[:2]
    for yy in range(h):
        for xx in range(w):
            X, Y = x + xx, y + yy
            if 0 <= X < FW and 0 <= Y < FH and g[yy, xx, 3]:
                out[Y, X] = g[yy, xx]
    return out


WHITE = (240, 242, 246, 255)
YELLOW = (245, 196, 81, 255)
ACCENT = (255, 110, 122, 255)
Z_BIG = glyph(['1111', '0010', '0100', '1111'], WHITE)
Z_SMALL = glyph(['111', '010', '111'], WHITE)
BANG = glyph(['11', '11', '11', '11', '00', '11'], YELLOW)
SPARK = glyph(['010', '111', '010'], YELLOW, outline=None)
HEART = glyph(['1010', '1111', '0110'], ACCENT)


# ---- camminata (vista di lato, verso destra) ----
def legs(a, front_dx, back_dx, top=52, split=24):
    out = a.copy()
    out[top:] = 0
    for y in range(top, FH):
        for x in range(FW):
            if a[y, x, 3]:
                dx = front_dx if x >= split else back_dx
                nx = x + dx
                if 0 <= nx < FW:
                    out[y, nx] = a[y, x]
    return out


def arm_swing(a, dx, rows=(50, 53), x_from=26):
    """Sposta di dx la mano/avambraccio visibile."""
    out = a.copy()
    for y in range(*rows):
        row = a[y].copy()
        skin = [x for x in range(x_from, FW) if row[x, 3] and row[x, 0] > 200 and row[x, 1] > 150]
        for x in skin:
            out[y, x] = a[y, x - 1] if x - 1 >= 0 and not (row[x - 1, 0] > 200 and row[x - 1, 1] > 150) else out[y, x]
        for x in skin:
            nx = x + dx
            if 0 <= nx < FW:
                out[y, nx] = row[x]
    return out


# ---- camminata (vista di lato) ----
# Le gambe si muovono come due pezzi interi: la coscia ruota dall'anca e dal ginocchio in giù
# (scarpa compresa) si sposta tutto insieme, così la scarpa non si deforma mai.
HIP, KNEE = 53, 58


def darken(a, k=0.62):
    out = a.copy()
    out[..., :3] = (out[..., :3].astype(float) * k).astype(np.uint8)
    return out


def leg_swing(leg, dx):
    """Inclina una gamba: 0 all'anca, dx pieno dal ginocchio in giù."""
    out = np.zeros_like(leg)
    for y in range(leg.shape[0]):
        t = min(1.0, max(0.0, (y - HIP) / (KNEE - HIP)))
        o = round(dx * t)
        for x in range(FW):
            if leg[y, x, 3] and 0 <= x + o < FW:
                out[y, x + o] = leg[y, x]
    return out


SIDE_BODY = SIDE.copy()
SIDE_BODY[HIP:] = 0

# Una gamba di profilo disegnata a mano con la palette del personaggio (punta della scarpa a destra)
LEG_ART = [
    '1AAAA41...',
    '1AAAA41...',
    '1AAA441...',
    '1AAAA41...',
    '1AAA441...',
    '1AA44411..',
    '1888888881',
    '1CIIIC88H1',
    '1111111111',
]
LEG_PAL = {
    '1': (0, 0, 18, 255), 'A': (56, 56, 58, 255), '4': (29, 27, 37, 255), '8': (39, 39, 48, 255),
    'C': (114, 120, 145, 255), 'I': (219, 227, 236, 255), 'H': (130, 135, 156, 255)
}
SIDE_LEG = blank()
for j, row in enumerate(LEG_ART):
    for i, c in enumerate(row):
        if c != '.':
            SIDE_LEG[HIP + j, 19 + i] = LEG_PAL[c]


def walk_frame(dx, lift=0, arm=0):
    """dx > 0: gamba vicina avanti. lift: il corpo si alza nel passo intermedio."""
    out = blank()
    over(out, darken(leg_swing(SIDE_LEG, -dx)))  # gamba lontana, più scura, dietro
    over(out, leg_swing(SIDE_LEG, dx))  # gamba vicina
    body = arm_swing(SIDE_BODY, arm) if arm else SIDE_BODY
    over(out, shift(body, dy=-lift))
    if lift:  # riempie il buco tra busto alzato e gambe con la riga dei pantaloni
        for x in range(FW):
            if SIDE[HIP, x, 3] and not out[HIP - 1, x, 3]:
                out[HIP - 1, x] = SIDE[HIP, x]
    return out


walk_r = [
    walk_frame(3, arm=-1),
    walk_frame(1, lift=1),
    walk_frame(-1, lift=1),
    walk_frame(-3, arm=1),
    walk_frame(-1, lift=1),
    walk_frame(1, lift=1),
]
walk_l = [np.ascontiguousarray(f[:, ::-1]) for f in walk_r]

# ---- riposo (di fronte e di tre quarti) ----
idle_front = [FRONT, FRONT, breathe(FRONT), breathe(FRONT), FRONT, blink(FRONT), FRONT, breathe(FRONT)]
idle_side = [THREE_Q, THREE_Q, breathe(THREE_Q), breathe(THREE_Q), THREE_Q, blink(THREE_Q), THREE_Q, breathe(THREE_Q)]

# ---- si guarda intorno: la sequenza originale ----
look = base[:]

# ---- salto di gioia ----
# Si piega (carica), si allunga nello slancio, raccoglie le gambe in alto, atterra piegato e si rialza.
def crouch(a, n, split=50):
    """Abbassa busto e testa di n pixel sopra le gambe: le ginocchia sembrano piegarsi."""
    out = a.copy()
    out[:split + n] = 0
    out[n:split + n] = np.where(a[:split, :, 3:4] > 0, a[:split], out[n:split + n])
    for y in range(split, split + n):  # ricuce il bordo dei pantaloni
        for x in range(FW):
            if not out[y, x, 3] and a[split, x, 3]:
                out[y, x] = a[split, x]
    return out


def stretch(a, n, split=52):
    """Allunga le gambe di n pixel (slancio): ripete la riga dei pantaloni sotto il busto."""
    out = blank()
    out[:split] = a[:split]
    for i in range(n):
        out[split + i] = a[split]
    out[split + n:] = a[split:FH - n]
    return out


def tuck(a, n=2, top=55):
    """Gambe raccolte in aria: piedi tirati su di n pixel."""
    out = a.copy()
    out[top:] = 0
    out[top:FH - n] = a[top + n:]
    return out


jump = [
    crouch(FRONT, 2),
    shift(stretch(FRONT, 1), dy=-4),
    stamp(stamp(shift(tuck(blink(FRONT)), dy=-8), SPARK, 6, 10), SPARK, 38, 8),
    stamp(stamp(shift(tuck(blink(FRONT)), dy=-9), SPARK, 4, 14), SPARK, 39, 4),
    stamp(shift(FRONT, dy=-5), SPARK, 40, 12),
    shift(FRONT, dy=-1),
    crouch(FRONT, 2),
    crouch(FRONT, 1),
    FRONT,
]

# ---- sorpresa / avviso ----
surprise = [
    stamp(shift(FRONT, dy=-2), BANG, 34, 4),
    stamp(shift(FRONT, dy=-1), BANG, 34, 3),
    stamp(FRONT, BANG, 34, 4),
    stamp(FRONT, BANG, 34, 4),
    stamp(blink(FRONT), BANG, 34, 4),
    stamp(FRONT, BANG, 34, 4),
]

# ---- dorme ----
sleep = []
zpath = [(31, 14), (32, 11), (33, 8), (34, 5)]
for i in range(8):
    f = SLEEPY if i % 4 < 2 else breathe(SLEEPY)
    z1 = zpath[i % 4]
    f = stamp(f, Z_SMALL, *z1)
    z2 = zpath[(i + 2) % 4]
    f = stamp(f, Z_BIG, z2[0] + 4, z2[1] - 4)
    sleep.append(f)


# Colori della mano originale (usati per le mani sul portatile)
HAND_COL = {'h': (247, 210, 184, 255), 'm': (239, 176, 149, 255), 'l': (220, 150, 135, 255)}


# ---- lavora al portatile ----
# Portatile in alluminio visto da dietro: coperchio con riflesso e logo, base con bordo chiaro.
# Le mani spuntano ai lati della base e battono a turno; la luce dello schermo illumina il viso.
LAPTOP_LID = ['................',
       '.rrrrrrrrrrrrrr.',
       'rhhhhhhhhhhhhhhr',
       'rhaaaaaaaaaaaadr',
       'rhaaaaaaaaaaaadr',
       'rhaaaaaaaaaaaadr',
       'rhaaaaaaaaaaaadr',
       'rhaaaaaaaaaaaadr',
       'rhaaaaaaaaaaaadr',
       'rddddddddddddddr',
       '.rrrrrrrrrrrrrr.']
LID_COL = {'r': (12, 13, 18, 255), 'h': (196, 202, 212, 255), 'a': (150, 157, 170, 255), 'd': (104, 110, 122, 255)}
BASE_COL = {'top': (210, 216, 225, 255), 'side': (120, 126, 138, 255), 'line': (12, 13, 18, 255)}


def screen_glow(a, k):
    """Riflesso bluastro dello schermo sul viso (righe del viso, solo pixel di pelle)."""
    out = a.copy()
    for y in range(30, 40):
        for x in range(FW):
            r, g, b, al = (int(v) for v in out[y, x])
            if al and r > 200 and g > 140 and b > 120:
                out[y, x] = (max(0, r - k * 4), g, min(255, b + k * 6), 255)
    return out


def laptop(a, typing, logo):
    out = screen_glow(a, 2 if logo else 1)
    x0, y0 = 15, 41
    for j, row in enumerate(LAPTOP_LID):
        for i, c in enumerate(row):
            if c != '.':
                out[y0 + j, x0 + i] = LID_COL[c]
    # logo al centro del coperchio
    lc = ACCENT if logo else (120, 60, 70, 255)
    for x, y in [(22, 45), (23, 45), (22, 46), (23, 46)]:
        out[y, x] = lc
    # base (vista dal bordo): riga chiara, riga laterale, contorno
    for x in range(12, 36):
        out[52, x] = BASE_COL['line'] if x in (12, 35) else BASE_COL['top']
        out[53, x] = BASE_COL['line'] if x in (12, 35) else BASE_COL['side']
        out[54, x] = BASE_COL['line']
    # mani ai lati: battono a turno (una si alza di un pixel)
    for side, hx in ((1, 12), (2, 32)):
        up = 1 if typing == side else 0
        hy = 50 - up
        for j, row in enumerate(['.hh.', 'hmml', '.ll.']):
            for i, c in enumerate(row):
                if c != '.':
                    out[hy + j, hx + i] = HAND_COL[c]
        for i in range(4):
            if not out[hy - 1, hx + i, 3] or out[hy - 1, hx + i, 0] > 150:
                out[hy - 1, hx + i] = OUTLINE
    return out


work = [laptop(FRONT, 1, True), laptop(FRONT, 2, True), laptop(FRONT, 1, True), laptop(breathe(FRONT), 2, True),
        laptop(FRONT, 1, True), laptop(blink(FRONT), 2, False), laptop(FRONT, 1, True), laptop(FRONT, 2, True)]

# ---- pensa (Claude Code al lavoro): tre puntini che compaiono uno alla volta ----
DOT = glyph(['11', '11'], WHITE)


def dots(a, n):
    out = a.copy()
    for i in range(n):
        out = stamp(out, DOT, 30 + i * 5, 10 - (i % 2))
    return out


think = []
for i in range(8):
    f = THREE_Q if i not in (2, 3) else breathe(THREE_Q)
    if i == 6:
        f = blink(THREE_Q)
    think.append(dots(f, i % 4))

ANIMS = {
    'idle': (idle_front, 4, True),
    'idleSide': (idle_side, 4, True),
    'look': (look, 5, False),
    'walkRight': (walk_r, 8, True),
    'walkLeft': (walk_l, 8, True),
    'jump': (jump, 11, False),
    'surprise': (surprise, 6, False),
    'sleep': (sleep, 3, True),
    'work': (work, 5, True),
    'think': (think, 4, True),
}

frames, meta = [], {}
for name, (fs, fps, loop) in ANIMS.items():
    meta[name] = {'start': len(frames), 'count': len(fs), 'fps': fps, 'loop': loop}
    frames.extend(fs)

sheet = Image.new('RGBA', (FW * len(frames), FH))
for i, f in enumerate(frames):
    sheet.paste(Image.fromarray(f), (i * FW, 0))
sheet.save(OUT / 'buddy.png', optimize=True)
(OUT / 'buddy.json').write_text(json.dumps({'frameWidth': FW, 'frameHeight': FH, 'animations': meta}, indent=2))

# ---- anteprima per controllo visivo (4x, sfondo come il dock) ----
S = 4
cols = max(len(fs) for fs, _, _ in ANIMS.values())
prev = Image.new('RGBA', (cols * FW * S + 140, len(ANIMS) * FH * S), (14, 16, 19, 255))
from PIL import ImageDraw
d = ImageDraw.Draw(prev)
for r, (name, (fs, _, _)) in enumerate(ANIMS.items()):
    d.text((6, r * FH * S + 8), name, fill=(200, 200, 200, 255))
    for c, f in enumerate(fs[:cols]):
        im = Image.fromarray(f).resize((FW * S, FH * S), Image.NEAREST)
        prev.alpha_composite(im, (140 + c * FW * S, r * FH * S))
prev.save(OUT / 'preview.png')

# GIF animato con tutte le animazioni in fila, per mostrarle
gif_frames = []
for name, (fs, fps, _) in ANIMS.items():
    reps = 2 if len(fs) <= 6 else 1
    for f in fs * reps:
        canvas = Image.new('RGBA', (FW * 3, FH * 3), (14, 16, 19, 255))
        canvas.alpha_composite(Image.fromarray(f).resize((FW * 3, FH * 3), Image.NEAREST))
        gif_frames.append((canvas.convert('RGB'), int(1000 / fps)))
gif_frames[0][0].save(OUT / 'demo.gif', save_all=True, append_images=[g for g, _ in gif_frames[1:]],
                      duration=[d for _, d in gif_frames], loop=0)
print('frames', len(frames), meta)
