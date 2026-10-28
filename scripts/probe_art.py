# One-off check of border images and card art formats, so the app can use them well. Results go to the probe-results branch.
import json, re, io, os, sys, urllib.request
from PIL import Image, ImageSequence
UA = {"User-Agent": "Mozilla/5.0 (compatible; SNAP-Stat-probe/1.0)"}
out = {}; os.makedirs("probe", exist_ok=True)
def get(u, binary=False):
    r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40); b = r.read(); return b if binary else b.decode("utf-8", "replace")
def info(b, name):
    im = Image.open(io.BytesIO(b)); frames = getattr(im, "n_frames", 1)
    d = {"size": im.size, "mode": im.mode, "format": im.format, "frames": frames, "bytes": len(b)}
    rgba = im.convert("RGBA"); a = rgba.split()[3]
    w, h = rgba.size
    # how far in from each edge the image stays solid along the middle lines
    def run(seq):
        n = 0
        for v in seq:
            if v > 20: n += 1
            else: break
        return n
    mid_row = [a.getpixel((x, h // 2)) for x in range(w)]; mid_col = [a.getpixel((w // 2, y)) for y in range(h)]
    d["solidFromLeft"] = run(mid_row); d["solidFromRight"] = run(mid_row[::-1]); d["solidFromTop"] = run(mid_col); d["solidFromBottom"] = run(mid_col[::-1])
    d["transparentPct"] = round(100 * sum(1 for v in a.getdata() if v < 20) / (w * h), 1)
    th = rgba.copy(); th.thumbnail((300, 420)); bg = Image.new("RGBA", th.size, (255, 0, 255, 255)); bg.alpha_composite(th); bg.convert("RGB").save(f"probe/{name}.png")
    return d
# 1. Border list (Marvel Snap Zone pages)
borders = []
for pg in range(1, 6):
    try: html = get(f"https://marvelsnapzone.com/borders/?pg={pg}")
    except Exception as e: out.setdefault("errors", []).append(f"borders pg{pg}: {e}"); break
    found = re.findall(r'(https://static\.marvelsnap\.pro/borders/[^"\'\s)]+)', html)
    new = [u for u in dict.fromkeys(found) if u not in [b["url"] for b in borders]]
    for u in new: borders.append({"url": u, "id": u.rsplit("/", 1)[-1].split(".")[0]})
    if not new: break
out["borderCount"] = len(borders); out["borderIds"] = [b["id"] for b in borders]
out["borderPageSample"] = re.sub(r"\s+", " ", get("https://marvelsnapzone.com/borders/"))[:200]
# look for video/animated assets mentioned on the page
html1 = get("https://marvelsnapzone.com/borders/")
out["videoLinks"] = list(dict.fromkeys(re.findall(r'(https?://[^"\'\s]+\.(?:webm|mp4|gif|json))', html1)))[:20]
out["borders"] = {}
for b in borders[:200]:
    try: out["borders"][b["id"]] = info(get(b["url"], True), "border_" + b["id"]) if b["id"] in ("Common", "Fire", "FireBlue", "NeonNights", "CosmicBlack", "ChromaticRainbow", "WebBlue", "Faction_XMen", "Overloaded", "MetalChains") else {"frames": getattr(Image.open(io.BytesIO(get(b["url"], True))), "n_frames", 1)}
    except Exception as e: out["borders"][b["id"]] = {"error": str(e)}
# 2. Card data: raw fields for a card and its variants, and whether full art exists
api = json.loads(get("https://marvelsnapzone.com/getinfo/?searchtype=cards&searchcardstype=true"))
cards = api.get("success", {}).get("cards") or api.get("cards") or []
c = next((x for x in cards if x.get("name") in ("Spider-Man", "Alioth")), cards[0])
out["cardKeys"] = sorted(c.keys()); out["cardSample"] = {k: (str(v)[:160]) for k, v in c.items() if k != "variants"}
vs = c.get("variants") or []
out["variantKeys"] = sorted(vs[0].keys()) if vs else []; out["variantSample"] = {k: str(v)[:160] for k, v in (vs[0] if vs else {}).items()}
try: out["cardArt"] = info(get(c["art"], True), "card_base")
except Exception as e: out["cardArtErr"] = str(e)
if vs:
    try: out["variantArt"] = info(get(vs[0]["art"], True), "card_variant")
    except Exception as e: out["variantArtErr"] = str(e)
# 3. A card page: any full-art download links
try:
    page = get("https://marvelsnapzone.com/cards/" + (c.get("url", "").strip("/").split("/")[-1] or "spider-man") + "/")
    out["fullArtLinks"] = list(dict.fromkeys(re.findall(r'(https?://[^"\'\s]+(?:full|Full|art)[^"\'\s]*\.(?:webp|png|jpg))', page)))[:30]
    out["downloadAttrs"] = re.findall(r'<a[^>]+download[^>]*>', page)[:10]
except Exception as e: out["pageErr"] = str(e)
for i, u in enumerate(out.get("fullArtLinks", [])[:3]):
    try: out[f"full{i}"] = {"url": u, **info(get(u, True), f"full_{i}")}
    except Exception as e: out[f"full{i}"] = {"url": u, "error": str(e)}
json.dump(out, open("probe/result.json", "w"), indent=1)
print(json.dumps({k: v for k, v in out.items() if k != "borders"}, indent=1)[:3000])
