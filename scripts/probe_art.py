# One-off: draw what profile pictures look like with faces.json (the art cropped like the app does) for a sample.
import json, os, random, io, urllib.request
from PIL import Image, ImageDraw, ImageFont
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"}
os.makedirs("probe", exist_ok=True)
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read()
def font(n):
    try: return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", n)
    except Exception: return ImageFont.load_default()
F = json.load(open("faces.json"))["faces"]; L = json.load(open("faces-log.json"))
how = L.get("how", {})
random.seed(5)
m_ids = [i for i in F if how.get(i, "").startswith("m:")]; d_ids = [i for i in F if how.get(i, "").startswith("d:")]
pick = ["SpiderMan_05", "SpiderMan_07", "Carnage", "Hulk", "Annihilus", "GhostRider", "Sentinel", "HumanTorch"] + random.sample(m_ids, min(24, len(m_ids))) + random.sample(d_ids, min(32, len(d_ids)))
pick = [i for i in pick if i in F]
open("probe/log.txt", "w").write(f"faces {len(F)} matched {len(m_ids)} heads {len(d_ids)} misses {len(L.get('misses', {}))}\n")
HEX = 2 / 3 ** 0.5; CW, CH = 230, int(230 / HEX)
def hexmask(w, h):
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).polygon([(w * .25, 0), (w * .75, 0), (w, h / 2), (w * .75, h), (w * .25, h), (0, h / 2)], fill=255); return m
for s in range(0, len(pick), 16):
    chunk = pick[s:s + 16]; cols = 4; rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (CW + 10), rows * (CH + 30)), (20, 16, 42)); g = ImageDraw.Draw(sheet)
    for k, i in enumerate(chunk):
        X, Y = (k % cols) * (CW + 10) + 5, (k // cols) * (CH + 30) + 5
        try: art = Image.open(io.BytesIO(get(f"https://static.marvelsnap.pro/art/{i}.webp"))).convert("RGB")
        except Exception: continue
        x0, y0, x1, y1, ar = F[i]; bw, bh = x1 - x0, y1 - y0
        z = max(1, min(6, 1 / bw * (HEX / ar if ar >= HEX else 1)))
        cx, cy = x0 + bw / 2, y0 + bh * 0.46
        W, H = art.size; vw = W / z; vh = vw / HEX
        if vh > H: vh = H; vw = vh * HEX
        left = min(max(cx * W - vw / 2, 0), W - vw); top = min(max(cy * H - vh / 2, 0), H - vh)
        crop = art.crop((int(left), int(top), int(left + vw), int(top + vh))).resize((CW, CH), Image.LANCZOS)
        sheet.paste(crop, (X, Y), hexmask(CW, CH))
        g.text((X, Y + CH + 4), f"{i} {how.get(i, '')}", fill=(255, 216, 77), font=font(12))
    sheet.save(f"probe/faces_{s // 16 + 1:02d}.jpg", quality=82)
