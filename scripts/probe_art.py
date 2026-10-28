# One-off check of border images and card art (round 4). Results go to the probe-results branch.
import io, json, os, re, urllib.request
from PIL import Image

os.makedirs("probe", exist_ok=True)
out = {}
UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36"


def get(url, binary=True):
    r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60)
    b = r.read()
    return b if binary else b.decode("utf-8", "replace")


# 1. Every border id from both sites
ids = []
for pg in range(1, 6):
    try:
        html = get("https://marvelsnapzone.com/borders/" + (f"?pg={pg}" if pg > 1 else ""), False)
        new = [m for m in re.findall(r'href="/borders/([^/"]+)/"', html) if m not in ids]
        if not new: break
        ids += new
    except Exception as e:
        out["mszErr"] = str(e)[:80]; break
try:
    sf = get("https://snap.fan/cosmetics/borders/", False)
    sfids = list(dict.fromkeys(re.findall(r'/cosmetics/borders/([A-Za-z0-9_]+)/', sf)))
    out["sfIds"] = sfids
    ids += [i for i in sfids if i not in ids]
except Exception as e:
    out["sfErr"] = str(e)[:80]
out["ids"] = ids

# 2. Which have an animated preview on snap.fan, and how big
out["anim"] = {}
thumbs = []
KEEP = {"Fire", "Common", "NeonNights", "Infinity", "CosmicBlack", "MetalChains", "Pax2025", "ChromaticGold", "Champion", "WebBlue"}
for b in ids:
    u = f"https://game-assets.snap.fan/ConvertedRenders/Borders/{b}.webp"
    try:
        data = get(u)
        im = Image.open(io.BytesIO(data))
        durs = []
        for i in range(min(getattr(im, "n_frames", 1), 200)):
            im.seek(i); durs.append(im.info.get("duration", 0))
        out["anim"][b] = {"size": im.size, "frames": getattr(im, "n_frames", 1), "bytes": len(data), "ms": sum(durs), "loop": im.info.get("loop")}
        im.seek(0); f0 = im.convert("RGBA")
        f0.save(f"probe/f0_{b}.png")
        thumbs.append((b, f0))
        if b in KEEP:
            open(f"probe/full_{b}.webp", "wb").write(data)
    except Exception as e:
        out["anim"][b] = {"err": str(e)[:60]}

# contact sheet of first frames
if thumbs:
    cols, tw, th = 10, 120, 160
    sheet = Image.new("RGB", (cols * tw, ((len(thumbs) + cols - 1) // cols) * th), (255, 0, 255))
    for i, (b, f0) in enumerate(thumbs):
        t = f0.copy(); t.thumbnail((tw, th)); sheet.paste(t, ((i % cols) * tw, (i // cols) * th), t)
    sheet.save("probe/anim_sheet.png")

# 3. Face pictures for variants: how many exist?
try:
    cd = json.loads(get("https://raw.githubusercontent.com/rhaddaddy/snap-stat/main/card-data.json", False))
    cards = [c for c in cd.get("cards", []) if c.get("id")][:400:20]
    res = {}
    for c in cards:
        for v in (c.get("variants") or [])[:3]:
            o = str(v.get("order") or "").zfill(2)
            name = f"{c['id']}_{o}_avatar"
            try:
                im = Image.open(io.BytesIO(get(f"https://static.marvelsnap.pro/avatars/{name}.webp"))); res[name] = im.size
                if len(res) <= 4: im.convert("RGBA").save(f"probe/av_{name}.png")
            except Exception as e:
                res[name] = str(e)[:30]
        try:
            im = Image.open(io.BytesIO(get(f"https://static.marvelsnap.pro/avatars/{c['id']}_avatar.webp"))); res[c["id"] + "_avatar"] = im.size
        except Exception as e:
            res[c["id"] + "_avatar"] = str(e)[:30]
    out["avatars"] = res
except Exception as e:
    out["avErr"] = str(e)[:100]

json.dump(out, open("probe/result4.json", "w"), indent=1)
print(json.dumps({k: (v if k != "anim" else len(v)) for k, v in out.items()})[:2000])
