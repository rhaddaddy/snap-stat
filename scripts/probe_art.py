# One-off check of border images and card art formats (round 2). Results go to the probe-results branch.
import json, re, io, os, urllib.request
from PIL import Image
UA = {"User-Agent": "Mozilla/5.0 (compatible; SNAP-Stat-probe/1.0)"}
out = {}; os.makedirs("probe", exist_ok=True)
def get(u, binary=False):
    r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40); b = r.read(); return b if binary else b.decode("utf-8", "replace")
def head(u):
    try:
        b = get(u, True); im = Image.open(io.BytesIO(b)); return {"ok": True, "size": im.size, "mode": im.mode, "bytes": len(b)}
    except Exception as e: return {"ok": False, "err": str(e)[:80]}
def thumb(u, name, size=(320, 420)):
    try:
        im = Image.open(io.BytesIO(get(u, True))).convert("RGBA"); im.thumbnail(size); bg = Image.new("RGBA", im.size, (255, 0, 255, 255)); bg.alpha_composite(im); bg.convert("RGB").save(f"probe/{name}.png"); return True
    except Exception as e: return str(e)[:80]
# 1. How borders appear in the page's HTML
html = get("https://marvelsnapzone.com/borders/")
i = html.find("ChromaticAqua"); out["borderHtml1"] = html[max(0, i - 900): i + 600]
j = html.find("Common.webp"); out["borderHtmlCommon"] = html[max(0, j - 700): j + 300]
out["staticUrls"] = sorted(set(re.findall(r'https://static\.marvelsnap\.pro/[^"\'\s)]+', html)))[:60]
# a border's own page
try:
    links = re.findall(r'href="(https://marvelsnapzone\.com/borders/[^"?#]+)"', html)
    out["borderPageLinks"] = list(dict.fromkeys(links))[:5]
    if links:
        bp = get(links[0]); out["borderPageStatic"] = sorted(set(re.findall(r'https://static\.marvelsnap\.pro/[^"\'\s)]+', bp)))[:30]
        out["borderPageVideo"] = list(dict.fromkeys(re.findall(r'(https?://[^"\'\s]+\.(?:webm|mp4|gif))', bp)))[:10]
except Exception as e: out["borderPageErr"] = str(e)
# 2. Variant full art: try likely names
cands = {}
for name in ["Alioth_02", "Alioth_2", "Alioth02", "467_02", "Alioth_v02"]:
    for folder in ["art", "variants", "art/variants"]:
        u = f"https://static.marvelsnap.pro/{folder}/{name}.webp"; cands[u] = head(u)
out["variantArtTries"] = {u: v for u, v in cands.items()}
# a card page: every static.marvelsnap.pro link, to see how variant art is named
for slug in ["alioth", "spider-man"]:
    try:
        pg = get(f"https://marvelsnapzone.com/cards/{slug}/")
        out[f"page_{slug}"] = sorted(set(re.findall(r'https://static\.marvelsnap\.pro/[^"\'\s)]+', pg)))[:60]
        out[f"page_{slug}_fullart_words"] = [m for m in re.findall(r'[^<>]{0,80}(?:full art|Full Art|download)[^<>]{0,80}', pg)][:8]
    except Exception as e: out[f"page_{slug}_err"] = str(e)
for u in list(dict.fromkeys(out.get("page_spider-man", [])))[:0]: pass
# thumbnails of a few
thumb("https://static.marvelsnap.pro/art/SpiderMan.webp", "full_spiderman")
for u in [x for x in out.get("page_spider-man", []) if "/art/" in x][:4]:
    thumb(u, "sm_" + u.rsplit("/", 1)[-1].split(".")[0])
json.dump(out, open("probe/result2.json", "w"), indent=1)
print(json.dumps(out, indent=1)[:2000])
