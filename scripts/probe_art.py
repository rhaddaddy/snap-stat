# One-off: find where the game's face portrait sits in each card's full art (the portrait is a crop of the same picture),
# by matching the middle of the portrait against the art at different sizes.
import json, os, random, time, urllib.request, io
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"}
os.makedirs("probe", exist_ok=True)
def get(u, t=40): return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t).read()
log = open("probe/log.txt", "w")
def say(*a): print(*a); print(*a, file=log); log.flush()
def font(n):
    try: return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", n)
    except Exception: return ImageFont.load_default()
cd = json.load(open("card-data.json")); cards = {c["id"]: c for c in cd["cards"] if c.get("status") == "released"}
random.seed(11)
ids = ["SpiderMan"] + [f"SpiderMan_{v['order']:02d}" for v in cards["SpiderMan"]["variants"][:15]]
pool = [c for c in cards if c != "SpiderMan"]
for cid in random.sample(pool, 30):
    ids.append(cid); vs = cards[cid]["variants"]
    if vs: v = random.choice(vs); ids.append(f"{cid}_{v['order']:02d}")
# The part of the portrait to look for: inside the hexagon, above the card's name
TB = (0.22, 0.12, 0.78, 0.56)
def gray(im, w):
    im = im.convert("RGB"); h = round(im.height * w / im.width); a = np.asarray(im.resize((w, h), Image.LANCZOS))
    return cv2.cvtColor(a, cv2.COLOR_RGB2GRAY)
res = {}; t_all = 0; pics = []
for i in ids:
    try:
        art = Image.open(io.BytesIO(get(f"https://static.marvelsnap.pro/art/{i}.webp"))).convert("RGB")
        av = Image.open(io.BytesIO(get(f"https://static.marvelsnap.pro/avatars/{i}_avatar.webp"))).convert("RGBA")
    except Exception as e: say("skip", i, e); continue
    t0 = time.time()
    AW = 320; A = gray(art, AW); ah, aw = A.shape
    bg = Image.new("RGBA", av.size, (0, 0, 0, 255)); bg.alpha_composite(av); avr = bg.convert("RGB")
    W, H = avr.size; tpl_full = avr.crop((int(TB[0] * W), int(TB[1] * H), int(TB[2] * W), int(TB[3] * H)))
    best = (-1, None)
    # the portrait's width in the art, as a share of the art's width
    for frac in np.geomspace(0.12, 1.2, 34):
        tw = int(AW * frac * (TB[2] - TB[0]))
        if tw < 16 or tw >= aw: continue
        T = gray(tpl_full, tw)
        if T.shape[0] >= ah: continue
        r = cv2.matchTemplate(A, T, cv2.TM_CCOEFF_NORMED); _, mx, _, loc = cv2.minMaxLoc(r)
        if mx > best[0]: best = (mx, (loc[0], loc[1], T.shape[1], T.shape[0], frac))
    t_all += time.time() - t0
    sc, (x, y, tw, th, frac) = best
    # Where the whole portrait (its hexagon) sits in the art, as fractions of the art's size
    pw = tw / (TB[2] - TB[0]); ph = th / (TB[3] - TB[1])
    px = x - TB[0] * pw; py = y - TB[1] * ph
    box = [px / aw, py / ah, (px + pw) / aw, (py + ph) / ah]
    res[i] = {"score": round(float(sc), 3), "box": [round(v, 4) for v in box], "art": art.size}
    pics.append((i, art, avr, box, sc))
say("matched", len(res), "per image", round(t_all / max(1, len(res)), 3), "s")
json.dump(res, open("probe/match.json", "w"), indent=0)
cell = 260; cols = 4
for s in range(0, len(pics), 16):
    chunk = pics[s:s + 16]; rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell * 2, rows * (cell + 22)), (20, 16, 42)); g = ImageDraw.Draw(sheet)
    for k, (i, art, avr, box, sc) in enumerate(chunk):
        X, Y = (k % cols) * cell * 2, (k // cols) * (cell + 22)
        t = art.copy(); t.thumbnail((cell, cell)); sheet.paste(t, (X, Y))
        g.rectangle([X + box[0] * t.width, Y + box[1] * t.height, X + box[2] * t.width, Y + box[3] * t.height], outline=(0, 255, 0) if sc > 0.6 else (255, 60, 60), width=3)
        a = avr.copy(); a.thumbnail((cell - 20, cell - 20)); sheet.paste(a, (X + cell + 4, Y + 10))
        g.text((X + 4, Y + cell + 3), f"{i} {sc:.2f}", fill=(255, 216, 77), font=font(14))
    sheet.save(f"probe/match_{s // 16 + 1:02d}.jpg", quality=80)
say("done")
