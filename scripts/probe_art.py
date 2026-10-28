# One-off: check every card back picture from Marvel Snap Zone and snap.fan, and try cleaning the ones with stray text.
import io, json, os, re, urllib.request
import numpy as np
from PIL import Image, ImageDraw
import cv2
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"}
os.makedirs("probe", exist_ok=True)
def get(u):
    try: return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read()
    except Exception: return b""
art = json.load(open("art.json"))
page = get("https://snap.fan/card-backs/").decode("utf-8", "replace")
sf = {m.group(1): m.group(0) for m in re.finditer(r'https://game-assets\.snap\.fan/card_back_images/([A-Za-z0-9_]+)-[0-9a-f]{16,}\.webp', page)}
CW, CH = 200, 272
def card_of(b):
    """The card itself, cut out of its picture and scaled to CW x CH, on black."""
    try: im = Image.open(io.BytesIO(b)).convert("RGBA")
    except Exception: return None
    a = np.asarray(im)[..., 3]; ys, xs = np.nonzero(a > 40)
    if not len(xs): return None
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)).resize((CW, CH), Image.LANCZOS)
    bg = Image.new("RGBA", (CW, CH), (0, 0, 0, 255)); bg.alpha_composite(im); return bg.convert("RGB")
def inner(im):  # inside the silver frame
    return np.asarray(im, dtype=np.float32)[int(CH * .06):int(CH * .94), int(CW * .07):int(CW * .93)]
def score(im):
    if im is None: return None
    x = inner(im); lum = x.mean(2)
    white = (lum > 200) & (x.std(2) < 25)
    rest = x[~white]
    q = (x // 32).astype(int); colors = len(np.unique(q[..., 0] * 64 + q[..., 1] * 8 + q[..., 2]))
    edges = cv2.Canny(lum.astype(np.uint8), 60, 160).mean() / 255
    return {"std": float(rest.std()) if len(rest) else 0.0, "white": float(white.mean()), "colors": colors, "edges": round(float(edges), 4)}
def placeholder(s):  # one flat colour with a line of white text: what the game shows before the real art loads
    return s is not None and s["colors"] <= 40 and s["std"] < 32
out, rows = {}, []
for b in art["cardbacks"]:
    cid = b["id"]
    m, f = card_of(get(b["img"])), card_of(get(sf[cid])) if cid in sf else None
    sm, sf_ = score(m), score(f)
    rec = {"name": b["name"], "msz": sm, "sf": sf_, "msz_ph": placeholder(sm), "sf_ph": placeholder(sf_)}
    fixed = None
    # stray text on Marvel Snap Zone's picture: the text from snap.fan's placeholder, at the same spot
    if m is not None and f is not None and rec["sf_ph"] and not rec["msz_ph"]:
        fx = np.asarray(f, dtype=np.float32); mask = ((fx.mean(2) > 170) & (fx.std(2) < 30)).astype(np.uint8) * 255
        mask[: int(CH * .06)] = 0; mask[int(CH * .94):] = 0; mask[:, : int(CW * .07)] = 0; mask[:, int(CW * .93):] = 0
        mask = cv2.dilate(mask, np.ones((5, 5), np.uint8))
        mx = np.asarray(m, dtype=np.float32); txt = ((mx.mean(2) > 170) & (mx.std(2) < 30))
        overlap = float((txt & (mask > 0)).sum() / max(1, (mask > 0).sum()))
        rec["overlay"] = round(overlap, 3)
        if overlap > 0.12:
            fixed = Image.fromarray(cv2.cvtColor(cv2.inpaint(cv2.cvtColor(np.asarray(m), cv2.COLOR_RGB2BGR), mask, 5, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB))
    out[cid] = rec
    rows.append((cid, m, f, fixed, rec))
json.dump(out, open("probe/result.json", "w"), indent=0)
# Review sheets: Marvel Snap Zone | snap.fan | cleaned
per = 8; W, H = CW * 3 + 12, CH + 30
for s0 in range(0, len(rows), per * 3):
    chunk = rows[s0:s0 + per * 3]
    sheet = Image.new("RGB", (W * 3, H * ((len(chunk) + 2) // 3)), (60, 30, 90)); d = ImageDraw.Draw(sheet)
    for n, (cid, m, f, fixed, rec) in enumerate(chunk):
        x, y = (n % 3) * W, (n // 3) * H
        for k, im in enumerate((m, f, fixed)):
            if im is not None: sheet.paste(im, (x + k * CW, y))
        lab = f"{cid} {'PH' if rec['msz_ph'] else ''}/{'PH' if rec['sf_ph'] else ''} {rec.get('overlay', '')}"
        d.text((x + 2, y + CH + 4), lab[:60], fill=(255, 255, 255))
    sheet.save(f"probe/sheet{s0 // (per * 3):02d}.jpg", quality=72)
print({k: sum(1 for r in out.values() if r[k]) for k in ("msz_ph", "sf_ph")}, sum(1 for r in out.values() if r.get("overlay", 0) > .12))
