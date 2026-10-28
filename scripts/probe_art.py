# One-off check of border images and card art (round 3). Results go to the probe-results branch.
import io, json, os, re, urllib.request
from PIL import Image

os.makedirs("probe", exist_ok=True)
out = {}
UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36"


def req(url, headers=None, binary=True):
    h = {"User-Agent": UA}; h.update(headers or {})
    r = urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=30)
    b = r.read()
    return r.status, dict(r.headers), (b if binary else b.decode("utf-8", "replace"))


def info(url, headers=None, save=None):
    try:
        st, hd, b = req(url, headers)
        im = Image.open(io.BytesIO(b))
        d = {"ok": st, "size": im.size, "mode": im.mode, "frames": getattr(im, "n_frames", 1), "bytes": len(b),
             "acao": hd.get("Access-Control-Allow-Origin") or hd.get("access-control-allow-origin"), "type": hd.get("Content-Type")}
        if save: im.convert("RGBA").save(f"probe/{save}.png")
        return d
    except Exception as e:
        return {"err": str(e)[:80]}


# 1. Do the art and face pictures load from the app's own address, and can the app read them (CORS)?
gh = {"Referer": "https://rhaddaddy.github.io/snap-stat/", "Origin": "https://rhaddaddy.github.io"}
out["cors"] = {u: info(u, gh) for u in [
    "https://static.marvelsnap.pro/art/SpiderMan.webp",
    "https://static.marvelsnap.pro/avatars/SpiderMan_avatar.webp",
    "https://static.marvelsnap.pro/borders/Fire.webp",
    "https://game-assets.snap.fan/ConvertedRenders/Borders/Champion.webp",
    "https://marvelsnapzone.com/wp-content/themes/blocksy-child/assets/media/cards/spiderman.webp",
]}

# 2. snap.fan's card page: picture address patterns (variants, avatars, frameless art)
for slug in ["SpiderMan", "Alioth"]:
    try:
        _, _, page = req(f"https://snap.fan/cards/{slug}/", binary=False)
        urls = sorted(set(re.findall(r'https://game-assets\.snap\.fan/[^"\'\s)\\]+', page)))
        out[f"sf_{slug}"] = urls[:120]
        pats = {}
        for u in urls:
            k = re.sub(r"/[^/]+$", "/", u); pats[k] = pats.get(k, 0) + 1
        out[f"sf_{slug}_patterns"] = pats
    except Exception as e:
        out[f"sf_{slug}"] = str(e)[:100]

# a few of each pattern, with sizes, and save them for a look
seen = 0
for slug in ["SpiderMan"]:
    urls = out.get(f"sf_{slug}") or []
    if isinstance(urls, list):
        byp = {}
        for u in urls:
            k = re.sub(r"/[^/]+$", "/", u)
            byp.setdefault(k, []).append(u)
        out["sf_samples"] = {}
        for k, us in byp.items():
            for u in us[:2]:
                if re.search(r"\.(webp|png|jpg)", u):
                    seen += 1
                    out["sf_samples"][u] = info(u, gh, save=f"sf_{seen}")

# 3. Face pictures for variants?
out["avatars"] = {v: info(f"https://static.marvelsnap.pro/avatars/{v}.webp") for v in
                  ["SpiderMan_05_avatar", "SpiderMan_avatar_05", "Alioth_02_avatar", "IronMan_03_avatar", "Hulk_avatar"]}
for v in ["SpiderMan_05", "SpiderMan", "Hulk_14"]:
    for u in [f"https://game-assets.snap.fan/ConvertedRenders/Avatars/{v}.webp", f"https://game-assets.snap.fan/ConvertedRenders/Avatar/{v}.webp",
              f"https://game-assets.snap.fan/ConvertedRenders/Variants/{v}.webp", f"https://game-assets.snap.fan/ConvertedRenders/Cards/{v}.webp",
              f"https://game-assets.snap.fan/ConvertedRenders/Art/{v}.webp"]:
        out.setdefault("sfguess", {})[u] = info(u)

# 4. Borders from snap.fan for the ones Marvel Snap Zone's links are missing
ids = ["ChromaticAqua", "ChromaticGold", "ChromaticRainbow", "WebBlue", "AntiqueGold", "Faction_Avengers", "Faction_XMen",
       "Infinity", "UltraLegendary", "Champion", "Overloaded", "Pax2025", "RefractionRainbow", "BorderBrains", "Fire", "NeonNights"]
out["sfBorders"] = {}
for i, b in enumerate(ids):
    out["sfBorders"][b] = info(f"https://game-assets.snap.fan/ConvertedRenders/Borders/{b}.webp", save=f"b_{b}")

json.dump(out, open("probe/result3.json", "w"), indent=1)
print(json.dumps(out)[:3000])
