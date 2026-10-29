# One-off: card backs side by side (Marvel Snap Zone | snap.fan | what the app uses) with any words the text reader
# finds on them, the game's face portraits for some cards and variants, and the emote list pages after page 2.
import json, os, io, urllib.request, re
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"}
os.makedirs("probe", exist_ok=True)
def get(u, t=40): return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t).read()
log = open("probe/log.txt", "w")
def say(*a): print(*a); print(*a, file=log); log.flush()
from PIL import Image, ImageDraw, ImageFont
import pytesseract
def font(n):
    try: return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", n)
    except Exception: return ImageFont.load_default()
for pg in range(3, 6):
    try: open(f"probe/msz_emotes{pg}.html", "wb").write(get(f"https://marvelsnapzone.com/emotes/?pg={pg}")); say("saved emotes page", pg)
    except Exception as e: say("ERR emotes", pg, e)
art = json.load(open("art.json")); backs = art.get("cardbacks", [])
checked = json.load(open("cardbacks/checked.json"))
def load(u):
    if not u: return None
    try:
        im = Image.open(io.BytesIO(get(u, 30)) if u.startswith("http") else u).convert("RGBA")
    except Exception: return None
    bg = Image.new("RGBA", im.size, (20, 16, 42, 255)); bg.alpha_composite(im); return bg.convert("RGB")
def words(im):
    if im is None: return ""
    try:
        g = im.convert("L").resize((im.width * 2, im.height * 2))
        t = pytesseract.image_to_string(g, config="--psm 11")
        return " ".join(w for w in re.findall(r"[A-Za-z]{4,}", t))[:60]
    except Exception as e: return "ERR " + str(e)[:30]
tw, th, lh = 120, 170, 40
rows_per = 12
found = []
for s in range(0, len(backs), rows_per):
    chunk = backs[s:s + rows_per]
    sheet = Image.new("RGB", (3 * tw + 330, len(chunk) * (th + 6)), (20, 16, 42)); g = ImageDraw.Draw(sheet)
    for i, b in enumerate(chunk):
        c = checked.get(b["id"]) or {}
        m_url = f"https://static.marvelsnap.pro/cardbacks/{b['id']}.webp"
        ims = [load(m_url), load(c.get("sf", "")), load(b.get("img", "")) if b.get("img") else None]
        Y = i * (th + 6)
        for k, im in enumerate(ims):
            if im: im.thumbnail((tw - 4, th - 4)); sheet.paste(im, (k * tw + 2, Y + 2))
            else: g.rectangle([k * tw + 8, Y + 8, k * tw + tw - 8, Y + th - 8], outline=(255, 80, 80), width=2)
        wm, wf = words(ims[0]), words(ims[1])
        g.text((3 * tw + 6, Y + 6), f"{s + i + 1} {b['name'][:26]}", fill=(255, 216, 77), font=font(13))
        g.text((3 * tw + 6, Y + 26), f"use: {c.get('use', '')}", fill=(200, 200, 230), font=font(12))
        g.text((3 * tw + 6, Y + 44), f"msz: {wm[:34]}", fill=(255, 150, 150), font=font(11))
        g.text((3 * tw + 6, Y + 60), f"sf: {wf[:34]}", fill=(150, 255, 150), font=font(11))
        found.append({"n": s + i + 1, "id": b["id"], "use": c.get("use"), "msz": wm, "sf": wf})
    sheet.save(f"probe/pairs_{s // rows_per + 1:02d}.jpg", quality=78)
json.dump(found, open("probe/words.json", "w"), indent=0)
say("pair sheets done", len(found))
# Face portraits
cd = json.load(open("card-data.json")); cards = {c["id"]: c for c in cd["cards"]}
ids = ["SpiderMan"] + [f"SpiderMan_{v['order']:02d}" for v in cards["SpiderMan"]["variants"][:23]]
for cid in ["Hulk", "Carnage", "Annihilus", "Sentinel", "GhostRider", "HumanTorch", "Deadpool", "Galactus"]:
    ids.append(cid); ids += [f"{cid}_{v['order']:02d}" for v in cards[cid]["variants"][:3]]
pics = []
for i in ids:
    try: im = Image.open(io.BytesIO(get(f"https://static.marvelsnap.pro/avatars/{i}_avatar.webp", 30))).convert("RGBA"); pics.append((i, im))
    except Exception as e: say("no avatar", i)
say("avatars", len(pics), "sizes", sorted({p[1].size for p in pics}))
FACE_BOX = [0.185, 0.07, 0.815, 0.7]
cell = 260
for s in range(0, len(pics), 16):
    chunk = pics[s:s + 16]; cols = 4; rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 20)), (60, 60, 70)); g = ImageDraw.Draw(sheet)
    for k, (i, im) in enumerate(chunk):
        X, Y = (k % cols) * cell, (k // cols) * (cell + 20)
        t = im.copy(); t.thumbnail((cell - 10, cell - 10)); ox, oy = X + 5, Y + 5
        bg = Image.new("RGBA", t.size, (255, 0, 255, 255)); bg.alpha_composite(t); sheet.paste(bg.convert("RGB"), (ox, oy))
        g.rectangle([ox + FACE_BOX[0] * t.width, oy + FACE_BOX[1] * t.height, ox + FACE_BOX[2] * t.width, oy + FACE_BOX[3] * t.height], outline=(0, 255, 0), width=2)
        g.text((X + 4, Y + cell + 2), f"{i} {im.size[0]}x{im.size[1]}", fill=(255, 216, 77), font=font(12))
    sheet.save(f"probe/avatars_{s // 16 + 1:02d}.jpg", quality=85)
say("done")
