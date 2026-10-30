# Looks for pictures or videos of the moving card backs that have no still picture, and grabs a frame from any video.
# Writes probe/moving.json, probe/moving-*.png and probe/moving-sheet.png.
import json, os, re, subprocess, urllib.request, io
from PIL import Image, ImageDraw, ImageFont
os.makedirs("probe", exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"}
def get(url, raw=False):
    try:
        b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
        return b if raw else b.decode("utf-8", "replace")
    except Exception as e:
        print("fail", url, e); return b"" if raw else ""
ids = ["CyclopsDoomsday_01", "DoctorDoomDoomsday_01", "DoctorDoomDoomsday_02", "SNAPWinterverse2026_01", "ZombieVenom_01"]
out = {}
sf = get("https://snap.fan/card-backs/")
msz = get("https://marvelsnapzone.com/cardbacks/")
for cid in ids:
    found = set()
    for page, who in ((sf, "sf"), (msz, "msz")):
        for m in re.finditer(r'https?://[^"\'\s<>()]*' + re.escape(cid) + r'[^"\'\s<>()]*', page): found.add(m.group(0))
        i = page.find(cid)
        if i >= 0: out.setdefault(cid + "_ctx_" + who, page[max(0, i - 600): i + 900])
    # Guesses at video and still paths on both sites
    for u in [f"https://static.marvelsnap.pro/cardbacks/{cid}.webm", f"https://static.marvelsnap.pro/cardbacks/{cid}.mp4", f"https://static.marvelsnap.pro/cardbacks/{cid}.png", f"https://static.marvelsnap.pro/cardbacks/{cid}.gif", f"https://static.marvelsnap.pro/cardbacks/{cid}.webp"]:
        found.add(u)
    out[cid] = sorted(found)
res = {}
frames = []
for cid in ids:
    res[cid] = []
    for u in out[cid]:
        b = get(u, raw=True)
        if not b: continue
        kind = "video" if b[:4] in (b"\x1aE\xdf\xa3",) or b[4:8] == b"ftyp" else "image"
        res[cid].append({"u": u, "bytes": len(b), "kind": kind})
        path = f"probe/moving-{cid}-{len(res[cid])}"
        try:
            if kind == "video":
                open(path + ".vid", "wb").write(b)
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1.5", "-i", path + ".vid", "-frames:v", "1", path + ".png"], check=False)
                os.remove(path + ".vid")
            else:
                Image.open(io.BytesIO(b)).convert("RGBA").save(path + ".png")
            if os.path.exists(path + ".png"): frames.append((cid, u, path + ".png"))
        except Exception as e:
            print("frame", u, e)
json.dump({"urls": out, "got": res}, open("probe/moving.json", "w"), indent=1)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
if frames:
    W, H = 220, 300
    sheet = Image.new("RGB", (W * min(5, len(frames)), (H + 40) * ((len(frames) + 4) // 5)), (30, 30, 40))
    for i, (cid, u, p) in enumerate(frames):
        im = Image.open(p).convert("RGBA"); im.thumbnail((W, H)); x, y = (i % 5) * W, (i // 5) * (H + 40)
        sheet.paste(im, (x, y), im); d = ImageDraw.Draw(sheet); d.text((x + 2, y + H + 4), cid, fill=(255, 220, 120), font=font); d.text((x + 2, y + H + 20), u[-40:], fill=(200, 200, 255), font=font)
    sheet.save("probe/moving-sheet.png")
print(json.dumps(res, indent=1))
