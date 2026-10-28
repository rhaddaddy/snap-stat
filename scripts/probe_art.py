# One-off: compare card back pictures from Marvel Snap Zone and snap.fan. Saves what it finds to the probe-results branch.
import io, json, os, re, urllib.request
from PIL import Image, ImageDraw
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"}
os.makedirs("probe", exist_ok=True)
out = {}
def get(u, binary=False, hdr=False):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers={**UA, "Origin": "https://rhaddaddy.github.io"}), timeout=30)
        b = r.read(); h = dict(r.headers)
        return r.status, h, b if binary else b.decode("utf-8", "replace")
    except urllib.error.HTTPError as e: return e.code, {}, b"" if binary else ""
    except Exception as e: return -1, {"err": str(e)[:80]}, b"" if binary else ""
pages, allurls = [], {}
for n in range(1, 15):
    st, h, p = get("https://snap.fan/card-backs/" + (f"?page={n}" if n > 1 else ""))
    urls = re.findall(r'https://game-assets\.snap\.fan/card_back_images/([A-Za-z0-9_]+)-([0-9a-f]{16,})\.(webp|png|webm|mp4)', p)
    new = 0
    for cid, hs, ext in urls:
        if (cid, ext) not in allurls: allurls[(cid, ext)] = f"https://game-assets.snap.fan/card_back_images/{cid}-{hs}.{ext}"; new += 1
    pages.append([n, st, len(urls), new])
    if n == 1:
        i = p.find("card_back_images"); out["sf_snippet"] = p[max(0, i - 1500):i + 1500]
        out["sf_pager"] = sorted(set(re.findall(r'href="([^"]*page=\d+[^"]*)"', p)))[:20]
        out["sf_links"] = sorted(set(re.findall(r'href="(/card-backs/[^"]+)"', p)))[:20]
    if not new: break
out["sf_pages"] = pages
out["sf_count"] = len(allurls)
out["sf_exts"] = sorted(set(e for _, e in allurls))
ids = ["CyclopsDoomsday_01", "DoctorDoomDoomsday_01", "DoctorDoomDoomsday_02", "SNAPWinterverse2026_01", "DraftBot_01", "ZombieVenom_01",
       "AntiPolarMagneto_01", "SuperiorIronMan_01", "SuperiorIronMan_02", "SpiderManBrandNewDay_01", "ArthurPendragon_01", "Carnage_01"]
tiles = []
for cid in ids:
    u = allurls.get((cid, "webp")) or allurls.get((cid, "png"))
    if not u: out[cid] = "not on snap.fan list"; continue
    st, h, b = get(u, True)
    info = [u, st, h.get("Content-Type") or h.get("content-type"), h.get("Access-Control-Allow-Origin") or h.get("access-control-allow-origin"), len(b)]
    try:
        im = Image.open(io.BytesIO(b)); info += [im.size, getattr(im, "n_frames", 1)]; im.seek(0); tiles.append((cid, im.convert("RGBA").copy()))
    except Exception as e: info.append("bad " + str(e)[:40])
    out[cid] = info
# A detail page, in case it has a moving version
st, h, p = get("https://snap.fan/card-backs/SuperiorIronMan_01/")
out["sf_detail"] = [st, sorted(set(re.findall(r'https://[^"\'\s)]+?\.(?:webp|png|webm|mp4)', p)))[:20]]
json.dump(out, open("probe/result.json", "w"), indent=1)
if tiles:
    W, H = 200, 300
    sheet = Image.new("RGB", (W * 6, (H + 20) * ((len(tiles) + 5) // 6)), (255, 0, 255)); d = ImageDraw.Draw(sheet)
    for n, (label, im) in enumerate(tiles):
        im.thumbnail((W, H)); x, y = (n % 6) * W, (n // 6) * (H + 20)
        sheet.paste(im, (x + (W - im.width) // 2, y), im); d.text((x + 2, y + H + 4), label[:34], fill=(0, 0, 0))
    sheet.save("probe/backs.png")
print(json.dumps(out)[:2000])
