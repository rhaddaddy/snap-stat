# Contact sheets of every card back: the picture the app uses now, next to the other source's picture,
# so each one can be checked by eye. Writes probe/cardbacks-NN.png and probe/cardbacks.json.
import json, io, os, urllib.request
from PIL import Image, ImageDraw, ImageFont
art = json.load(open("art.json")); checked = json.load(open("cardbacks/checked.json"))
backs = art["cardbacks"]
os.makedirs("probe", exist_ok=True)
def get(url):
    if not url: return None
    try:
        if url.startswith("cardbacks/"): return Image.open(url).convert("RGBA")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 SNAP-Stat-probe"})
        return Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert("RGBA")
    except Exception as e:
        print("fail", url, e); return None
W, H = 170, 238
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
def tile(im, label):
    t = Image.new("RGB", (W, H + 18), (60, 60, 70))
    # checkerboard shows transparent parts
    for y in range(0, H, 12):
        for x in range(0, W, 12):
            if (x // 12 + y // 12) % 2: ImageDraw.Draw(t).rectangle([x, y, x + 11, y + 11], fill=(90, 90, 100))
    if im:
        im = im.copy(); im.thumbnail((W, H))
        t.paste(im, ((W - im.width) // 2, (H - im.height) // 2), im)
    else:
        ImageDraw.Draw(t).text((10, H // 2), "NO PICTURE", fill=(255, 80, 80), font=font)
    ImageDraw.Draw(t).text((4, H + 2), label, fill=(255, 255, 255), font=font)
    return t
info = []
per = 15
for s in range(0, len(backs), per):
    group = backs[s:s + per]
    sheet = Image.new("RGB", (5 * (2 * W + 16), 3 * (H + 58)), (20, 20, 28))
    d = ImageDraw.Draw(sheet)
    for i, b in enumerate(group):
        c = checked.get(b["id"], {})
        use = c.get("use", "?")
        msz = f"https://static.marvelsnap.pro/cardbacks/{b['id']}.webp"
        cur = b.get("img") or ""
        alt = c.get("sf") if (cur.startswith("https://static.marvelsnap.pro") or cur.startswith("cardbacks/") or not cur) else msz
        a, bb = get(cur), get(alt)
        info.append({"n": s + i, "id": b["id"], "name": b["name"], "use": use, "cur": cur, "alt": alt, "curSize": a.size if a else None, "altSize": bb.size if bb else None})
        x, y = (i % 5) * (2 * W + 16), (i // 5) * (H + 58)
        sheet.paste(tile(a, f"#{s + i} now ({use})"), (x, y)); sheet.paste(tile(bb, "other"), (x + W + 4, y))
        d.text((x + 2, y + H + 22), f"{b['id']}"[:44], fill=(255, 220, 120), font=font)
        d.text((x + 2, y + H + 38), f"{b['name']}"[:44], fill=(200, 200, 255), font=font)
    sheet.save(f"probe/cardbacks-{s // per:02d}.png", optimize=True)
json.dump(info, open("probe/cardbacks.json", "w"), indent=1)
print("sheets", (len(backs) + per - 1) // per)
