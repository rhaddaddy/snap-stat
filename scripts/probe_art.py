# One-off: where do good card back pictures live? Saves what it finds to the probe-results branch.
import io, json, os, re, urllib.request
from PIL import Image
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"}
os.makedirs("probe", exist_ok=True)
out = {}
def get(u, binary=False):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30)
        b = r.read(); return r.status, r.headers.get("content-type", ""), b if binary else b.decode("utf-8", "replace")
    except urllib.error.HTTPError as e: return e.code, "", b"" if binary else ""
    except Exception as e: return -1, str(e)[:80], b"" if binary else ""
ids = ["CyclopsDoomsday_01", "DoctorDoomDoomsday_01", "DoctorDoomDoomsday_02", "SNAPWinterverse2026_01", "DraftBot_01", "ZombieVenom_01",
       "AntiPolarMagneto_01", "SuperiorIronMan_01", "SuperiorIronMan_02", "SpiderManBrandNewDay_01", "ArthurPendragon_01", "Carnage_01"]
# Marvel Snap Zone pages
st, ct, page = get("https://marvelsnapzone.com/card-backs/")
i = page.find("msz-cat-i"); out["msz_list"] = [st, page[i:i + 2500]]
for cid in ids[:3] + ["ZombieVenom_01", "SuperiorIronMan_01"]:
    st, ct, p = get(f"https://marvelsnapzone.com/card-backs/{cid}/")
    tags = re.findall(r'<(?:img|video|source)[^>]+>', p)
    out["msz_page_" + cid] = [st, [t for t in tags if re.search(r"cardback|card-back|\.webm|\.mp4|" + cid.split("_")[0], t, re.I)][:12]]
# snap.fan and others
for u in ["https://snap.fan/cosmetics/card-backs/", "https://snap.fan/card-backs/", "https://snap.fan/cardbacks/", "https://snap.fan/cosmetics/", "https://marvelsnap.pro/cardbacks/", "https://marvelsnap.pro/card-backs/"]:
    st, ct, p = get(u)
    out["page " + u] = [st, sorted(set(re.findall(r'https?://[^"\'\s)]+?(?:webp|png|jpg|webm|mp4)', p)))[:25], [m for m in re.findall(r'href="(/[^"]*(?:card-?back|cosmetic)[^"]*)"', p, re.I)][:15]]
tiles = []
for cid in ids:
    res = {}
    for name, u in [("msz", f"https://static.marvelsnap.pro/cardbacks/{cid}.webp"), ("msz_png", f"https://static.marvelsnap.pro/cardbacks/{cid}.png"),
                    ("sf_cr", f"https://game-assets.snap.fan/ConvertedRenders/CardBacks/{cid}.webp"), ("sf_cr2", f"https://game-assets.snap.fan/ConvertedRenders/Cardbacks/{cid}.webp"),
                    ("sf_cb", f"https://game-assets.snap.fan/cardbacks/{cid}.webp")]:
        st, ct, b = get(u, True)
        info = [st, ct, len(b)]
        if st == 200 and b:
            try:
                im = Image.open(io.BytesIO(b)); info += [im.size, getattr(im, "n_frames", 1)]
                im.seek(0); tiles.append((cid + " " + name, im.convert("RGBA").copy()))
            except Exception as e: info.append("not an image " + str(e)[:40])
        res[name] = info
    out[cid] = res
json.dump(out, open("probe/result.json", "w"), indent=1)
if tiles:
    W, H = 200, 280
    sheet = Image.new("RGB", (W * 6, (H + 20) * ((len(tiles) + 5) // 6)), (255, 0, 255))
    from PIL import ImageDraw
    d = ImageDraw.Draw(sheet)
    for n, (label, im) in enumerate(tiles):
        im.thumbnail((W, H)); x, y = (n % 6) * W, (n // 6) * (H + 20)
        sheet.paste(im, (x + (W - im.width) // 2, y), im); d.text((x + 2, y + H + 4), label[:34], fill=(0, 0, 0))
    sheet.save("probe/backs.png")
print(json.dumps(out)[:3000])
