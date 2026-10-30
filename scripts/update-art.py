# Builds art.json: each season's key art (the picture the game shows while it loads that season) and every card back,
# both from Marvel Snap Zone. The pictures stay on their servers; this only lists where they are.
#   seasons:   { "2026-09": { "img": ..., "title": "Axis: Inversion", "link": ... } }   keyed by the month the season starts
#   cardbacks: [ { "id": "ArthurPendragon_01", "name": ..., "added": ..., "img": ... } ]
#   titles:    [ "+5 Energy IRL", ... ]   every title's name, from snap.fan
#   emotes:    [ { "id": "DeadpoolOuchAnim", "name": ..., "kind": "image" | "anim" | "text", "img": ..., "sf": ..., "texts": [...], "added": ... } ]
# Run by .github/workflows/update-cards.yml.
import html, json, os, re, sys, urllib.request
from datetime import datetime, timezone

UA = {"User-Agent": "Mozilla/5.0 (compatible; SNAP-Stat-art-updater/1.0; +https://github.com/rhaddaddy/snap-stat)"}
MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read().decode("utf-8", "replace")


def clean(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


try: prev = json.load(open("art.json"))
except Exception: prev = {}

# ---------- Season key art ----------
seasons = dict(prev.get("seasons") or {})
pages = 0
for n in range(1, 16):
    url = "https://marvelsnapzone.com/seasons/" if n == 1 else f"https://marvelsnapzone.com/seasons/page/{n}/"
    try: page = get(url)
    except Exception as e: print("seasons page", n, e); break
    pages += 1; new = 0
    # Older seasons' pages are named a little differently ("marvel-snap-june-2023-season-pass"), so look for the month and year anywhere in the link.
    mon_re = "|".join(MONTHS)
    for m in re.finditer(r'<a class="ct-media-container[^"]*" href="(https://marvelsnapzone\.com/[a-z0-9-]*?\b(' + mon_re + r')-(\d{4})\b[a-z0-9-]*/)"(?: aria-label="([^"]*)")?[^>]*>\s*<img[^>]+src="([^"]+)"', page):
        link, mon, year, label, img = m.group(1), m.group(2), m.group(3), clean(m.group(4) or ""), html.unescape(m.group(5))
        if "season" not in link and "season" not in label.lower(): continue
        key = f"{year}-{MONTHS.index(mon) + 1:02d}"
        title = re.sub(r"^Marvel Snap \w+ \d{4} Season( Pass)?\s*[–-]\s*", "", label).strip() or label
        title = re.sub(r"\s*[–-]\s*Marvel Snap .*$", "", title).strip() or title
        img = re.sub(r"\?.*$", "", img) + "?fit=768%2C432&ssl=1" if "i0.wp.com" in img else img
        if seasons.get(key, {}).get("img") != img: new += 1
        seasons[key] = {"img": img, "title": title[:80], "link": link}
    if not re.search(r"ct-media-container", page): break  # past the last page
    if n > 1 and not new and len(seasons) > 45: break
print(len(seasons), "seasons with art from", pages, "pages")

# ---------- Card backs ----------
backs, seen = [], set()
for pg in range(1, 12):
    try: page = get("https://marvelsnapzone.com/card-backs/" + (f"?pg={pg}" if pg > 1 else ""))
    except Exception as e: print("card backs page", pg, e); break
    new = 0
    for m in re.finditer(r'<a class="msz-cat-i[^"]*" href="/card-backs/([^/"]+)/">(.*?)</a>', page, re.S):
        cid, body = m.group(1), m.group(2)
        if cid in seen or not re.fullmatch(r"[A-Za-z0-9_]+", cid): continue
        seen.add(cid); new += 1
        g = lambda pat: (lambda mm: clean(mm.group(1)) if mm else "")(re.search(pat, body, re.S))
        img = re.search(r'<img[^>]+src="([^"]+)"', body)
        backs.append({"id": cid, "name": g(r'msz-cat-i__name">(.*?)</span>') or cid, "added": g(r'msz-cat-i__date">(.*?)</span>').replace("Added in ", ""),
                      "img": img.group(1) if img else f"https://static.marvelsnap.pro/cardbacks/{cid}.webp"})
    if not new: break
print(len(backs), "card backs")
if len(backs) < 20: backs = prev.get("cardbacks") or backs

# ---------- Checking each card back's picture ----------
# Some card backs move in the game, and their still pictures come out wrong: black with "X Cardback" written on it,
# or the art with that text across it. Each one is checked against snap.fan's picture of it: the better one is used,
# stray text is painted out (saved in cardbacks/), and if neither is any good the app draws a tile instead.
try:
    import io
    import numpy as np, cv2
    from PIL import Image
    have_cv = True
except Exception as e:
    print("Can't check card back pictures:", e); have_cv = False

def get_bytes(url):
    try: return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
    except Exception: return b""

def card_crop(b):
    """The card itself (without the see-through space round it), as RGBA."""
    try: im = Image.open(io.BytesIO(b)).convert("RGBA")
    except Exception: return None
    a = np.asarray(im)[..., 3]; ys, xs = np.nonzero(a > 40)
    if len(xs) < 100: return None
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    c = im.crop((x0, y0, x1, y1))
    c.info["box"] = [round(x0 / im.width, 4), round(y0 / im.height, 4), round(x1 / im.width, 4), round(y1 / im.height, 4)]  # where the card is in the picture
    return c

def inner(rgb):
    h, w = rgb.shape[:2]; return rgb[int(h * .06):int(h * .94), int(w * .07):int(w * .93)]

def look(im):
    """How much is going on in the picture, and whether it's only a flat colour with a line of text (a stand-in)."""
    x = inner(np.asarray(im.convert("RGB").resize((200, 272), Image.LANCZOS), dtype=np.float32))
    blur = cv2.GaussianBlur(x, (0, 0), 9); r = np.abs(x - blur).mean(2)
    busy = r >= 12; ys = np.nonzero(busy.any(1))[0]
    band = (ys.max() - ys.min()) / x.shape[0] if len(ys) else 0
    flat = 1 - busy.mean()
    edges = float(cv2.Canny(x.mean(2).astype(np.uint8), 60, 160).mean() / 255)
    dark = float((x.mean(2) < 28).mean())  # a moving card back's first frame is often nearly all black
    stand_in = flat > 0.86 and band < 0.3 or float(x.std()) < 6 or dark > 0.82
    return {"detail": round(edges + float(x.std()) / 500, 4), "standIn": bool(stand_in), "dark": round(dark, 3), "hash": dhash(im)}

def dhash(im):
    """A fingerprint of the picture, to spot the same picture listed for two different card backs."""
    g = np.asarray(im.convert("L").resize((17, 16), Image.LANCZOS), dtype=np.int16)
    bits = (g[:, 1:] > g[:, :-1]).flatten()
    return "".join("1" if b else "0" for b in bits)

def ham(a, b): return sum(x != y for x, y in zip(a or "", b or "")) if a and b and len(a) == len(b) else 999

try:
    import pytesseract; pytesseract.get_tesseract_version(); have_ocr = True
except Exception: have_ocr = False
def label_words(im):
    """Words like PLACEHOLDER or CARDBACK printed on a stand-in picture."""
    if not have_ocr or im is None: return ""
    try:
        g = im.convert("L").resize((im.width * 2, im.height * 2))
        t = pytesseract.image_to_string(g, config="--psm 11").lower()
        return " ".join(sorted({w for w in ("placeholder", "cardback", "golden version") if w in t.replace("pmace", "place")}))
    except Exception: return ""

def text_line(im):
    """A line of white text across a card back (the game's stand-in label showing through the art), if there is one."""
    W, H = 348, 480
    rgb = np.asarray(im.convert("RGB").resize((W, H), Image.LANCZOS))
    lum = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY); sat = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)[..., 1]
    th = cv2.morphologyEx(lum, cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_RECT, (13, 13)))  # thin bright strokes
    cand = ((th > 60) & (sat < 80) & (lum > 140)).astype(np.uint8)
    cand[: int(H * .1)] = 0; cand[int(H * .9):] = 0; cand[:, : int(W * .1)] = 0; cand[:, int(W * .9):] = 0
    bh = int(H * .045); rows = cand.sum(1).astype(float)
    y0 = int(np.argmax(np.convolve(rows, np.ones(bh), "valid")))
    d = lambda a, b: rows[max(0, a):max(0, b)].sum() / max(1, (b - a) * W)
    dens = d(y0, y0 + bh); around = max(d(y0 - bh, y0 - bh // 3), d(y0 + bh + bh // 3, y0 + 2 * bh))
    n = sum(1 for st in cv2.connectedComponentsWithStats(cand[y0:y0 + bh], 8)[2][1:] if st[4] >= 4)
    band = np.zeros_like(cand); band[max(0, y0 - 3):y0 + bh + 3] = 1
    return {"y": y0 / H, "dens": float(dens), "iso": float(dens / (around + 1e-3)), "n": n, "mask": cand * band}

def paint_out(im, t):
    W, H = im.size
    m = cv2.resize(t["mask"] * 255, (W, H), interpolation=cv2.INTER_NEAREST)
    m = cv2.dilate(m, np.ones((max(5, W // 70),) * 2, np.uint8))
    out = cv2.inpaint(cv2.cvtColor(np.asarray(im.convert("RGB")), cv2.COLOR_RGB2BGR), m, max(5, W // 100), cv2.INPAINT_TELEA)
    o = Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB)).convert("RGBA"); o.putalpha(im.split()[3]); return o

CHECK_V = 4  # bump to check every card back again (4: also where the card sits in each picture)
if have_cv and backs:
    os.makedirs("cardbacks", exist_ok=True)
    try: checked = json.load(open("cardbacks/checked.json"))
    except Exception: checked = {}
    page = ""
    try: page = get("https://snap.fan/card-backs/")
    except Exception as e: print("snap.fan card backs:", e)
    sf = {m.group(1): m.group(0) for m in re.finditer(r'https://game-assets\.snap\.fan/card_back_images/([A-Za-z0-9_]+)-[0-9a-f]{16,}\.webp', page)}
    sf_names = {m.group(1): clean(m.group(2)) for m in re.finditer(r'data-cb-key="([A-Za-z0-9_]+)" data-cb-name="([^"]*)"', page)}
    known = {b["id"] for b in backs}
    for cid, u in sf.items():  # ones snap.fan has and Marvel Snap Zone doesn't
        if cid not in known: backs.append({"id": cid, "name": sf_names.get(cid) or cid, "added": "", "img": ""})
    tally = {}
    for b in backs:
        cid, m_url, f_url = b["id"], b.get("img") or f"https://static.marvelsnap.pro/cardbacks/{b['id']}.webp", sf.get(b["id"], "")
        old = checked.get(cid) or {}
        # Check again when snap.fan's picture changes, every week for ones that weren't fine, and once a month for the rest.
        age = (datetime.now(timezone.utc).timestamp() - float(old.get("at", 0))) / 86400
        if old and old.get("v") == CHECK_V and old.get("sf") == f_url and (age < 7 or old.get("use") == "msz" and age < 30):
            use = old.get("use")
        else:
            m_im, f_im = card_crop(get_bytes(m_url)), card_crop(get_bytes(f_url)) if f_url else None
            mq, fq = (look(m_im) if m_im else None), (look(f_im) if f_im else None)
            if fq: fq["words"] = label_words(f_im); fq["box"] = f_im.info.get("box")
            if mq: mq["words"] = label_words(m_im); mq["box"] = m_im.info.get("box")
            use, f_good = "none", bool(fq and not fq["standIn"] and not fq["words"])
            if mq and not mq["standIn"]:
                mt = text_line(m_im)
                ft = text_line(f_im) if f_im is not None and fq and fq["standIn"] else None
                same_spot = bool(ft and ft["dens"] >= 0.05 and abs(ft["y"] - mt["y"]) < 0.06)  # snap.fan's stand-in has its label right there
                stray = mt["dens"] >= 0.08 and mt["n"] >= 8 and (mt["iso"] >= 5 or same_spot)
                if stray and f_good: use = "sf"
                elif stray and (same_spot or (fq and fq["standIn"])):  # snap.fan only has a stand-in: it's one of the moving ones
                    paint_out(m_im, mt).save(f"cardbacks/{cid}.webp", "WEBP", quality=84, method=6); use = "fixed"
                elif f_good and fq["detail"] > mq["detail"] * 1.5: use = "sf"
                else: use = "msz"
            elif f_good: use = "sf"
            if use != "fixed" and os.path.exists(f"cardbacks/{cid}.webp"): os.remove(f"cardbacks/{cid}.webp")
            checked[cid] = {"v": CHECK_V, "use": use, "sf": f_url, "at": datetime.now(timezone.utc).timestamp(), "m": mq, "f": fq}
        tally[use] = tally.get(use, 0) + 1
        b["img"] = m_url if use == "msz" else f_url if use == "sf" else f"cardbacks/{cid}.webp" if use == "fixed" else ""
        if use == "none": b["noArt"] = True
        else: b.pop("noArt", None)
    # Marvel Snap Zone sometimes shows one card back's picture for another (Hulk shows Sam Wilson Red Hulk's, Avengers shows
    # Young Avengers'). When two card backs have the same picture there and snap.fan has a different, good one, use snap.fan's.
    def fp(cid, k): return ((checked.get(cid) or {}).get(k) or {}).get("hash")
    switched = 0
    for b in backs:
        cid = b["id"]; c = checked.get(cid) or {}
        if c.get("use") != "msz" or not c.get("sf"): continue
        f = c.get("f") or {}
        if not f or f.get("standIn") or f.get("words"): continue
        mh, fh = fp(cid, "m"), fp(cid, "f")
        twins = [o["id"] for o in backs if o["id"] != cid and ham(mh, fp(o["id"], "m")) <= 8]
        sf_twins = [o["id"] for o in backs if o["id"] != cid and ham(fh, fp(o["id"], "f")) <= 8]
        if twins and ham(mh, fh) > 12 and not sf_twins:
            c["use"] = "sf"; c["why"] = "same picture as " + twins[0] + " on Marvel Snap Zone"; switched += 1
    # Ones checked by eye (cardbacks/overrides.json): {"ZombieVenom_01": "none", ...}
    try: overrides = json.load(open("cardbacks/overrides.json"))
    except Exception: overrides = {}
    tally = {}
    for b in backs:
        cid = b["id"]; c = checked.get(cid) or {}; use = overrides.get(cid) or c.get("use") or "msz"
        if use == "fixed" and not os.path.exists(f"cardbacks/{cid}.webp"): use = c.get("use") if c.get("use") != "fixed" else "msz"
        tally[use] = tally.get(use, 0) + 1
        m_url, f_url = f"https://static.marvelsnap.pro/cardbacks/{cid}.webp", c.get("sf") or ""
        if not (b.get("img") or "").startswith("cardbacks/") and b.get("img") and "snap.fan" not in b.get("img", ""): m_url = b["img"]
        b["img"] = m_url if use == "msz" else f_url if use == "sf" and f_url else f"cardbacks/{cid}.webp" if use == "fixed" else ""
        if use == "none" or not b["img"]: b["noArt"] = True; b["img"] = ""
        else: b.pop("noArt", None)
        # Marvel Snap Zone's pictures are square, with the card in the middle: the app crops to it
        box = ((c.get("m") if use == "msz" else c.get("f") if use == "sf" else None) or {}).get("box")
        if box and (box[0] > 0.02 or box[1] > 0.02 or box[2] < 0.98 or box[3] < 0.98): b["box"] = box
        else: b.pop("box", None)
    json.dump(checked, open("cardbacks/checked.json", "w"), indent=0, sort_keys=True)
    print("card back pictures:", tally, "· switched to snap.fan for a repeated picture:", switched)

# ---------- Titles (the phrases you collect and show on your profile) ----------
# snap.fan lists every title's name on one page. Keep the old list if the page can't be read.
titles = list(prev.get("titles") or [])
try:
    page = get("https://snap.fan/titles/")
    found = [clean(t) for t in re.findall(r'data-title-name="[^"]*">(.*?)</li>', page, re.S)]
    found = sorted({t for t in found if 0 < len(t) <= 60}, key=lambda t: t.lower())
    if len(found) >= 200: titles = found
    print("titles:", len(found))
except Exception as e: print("titles page", e)

# ---------- Emotes ----------
# Marvel Snap Zone lists every emote with its picture and when it was added; snap.fan says which are text, picture or
# moving emotes, has the words of the text ones, and its pictures can be read by the app.
emotes, found = list(prev.get("emotes") or []), {}
for pg in range(1, 9):
    try: page = get("https://marvelsnapzone.com/emotes/" + (f"?pg={pg}" if pg > 1 else ""))
    except Exception as e: print("emotes page", pg, e); break
    new = 0
    for m in re.finditer(r'<a class="msz-cat-i[^"]*" href="/emotes/([^/"]+)/">(.*?)</a>', page, re.S):
        cid, body = m.group(1), m.group(2)
        if cid in found or not re.fullmatch(r"[A-Za-z0-9_]+", cid): continue
        new += 1
        g = lambda pat: (lambda mm: clean(mm.group(1)) if mm else "")(re.search(pat, body, re.S))
        img = re.search(r'<img[^>]+src="([^"]+)"', body)
        found[cid] = {"id": cid, "name": (g(r'msz-cat-i__name">(.*?)</span>') or cid)[:60], "added": g(r'msz-cat-i__date">(.*?)</span>').replace("Added in ", "")[:30],
                      "img": img.group(1) if img else f"https://static.marvelsnap.pro/emotes/{cid}.png", "src": g(r'msz-cat-i__src">(.*?)</span>')[:50]}
    if not new: break
try:
    page = get("https://snap.fan/emotes/")
    secs = [(m.start(), m.group(1)) for m in re.finditer(r"<h2[^>]*>(.*?)</h2>", page)]
    for si, (pos, sec) in enumerate(secs):
        kind = "text" if "text" in sec.lower() else "anim" if "anim" in sec.lower() else "image"
        for cell in re.split(r'<div class="emote-grid__cell"', page[pos:secs[si + 1][0] if si + 1 < len(secs) else len(page)])[1:]:
            mid = re.search(r'href="/emotes/([A-Za-z0-9_]+)/"', cell)
            if not mid: continue
            cid = mid.group(1); img = re.search(r'<img[^>]+src="(https://game-assets\.snap\.fan/[^"]+)"', cell)
            nm = re.search(r'class="emote-grid__name"[^>]*>\s*<a[^>]*>(.*?)</a>', cell, re.S)
            texts = [clean(t) for t in re.findall(r'game-emote__text-value[^>]*>(.*?)</div>', cell)][:2]
            e = found.setdefault(cid, {"id": cid, "name": (clean(nm.group(1)) if nm else texts[0] if texts else cid)[:60], "added": "", "img": ""})
            e["kind"] = kind
            if img: e["sf"] = img.group(1)
            if texts: e["texts"] = texts
except Exception as e: print("snap.fan emotes", e)
for e in found.values(): e.setdefault("kind", "anim" if e["id"].endswith("Anim") else "image")
if len(found) >= 50: emotes = sorted(found.values(), key=lambda e: (e["kind"] != "text",))
print("emotes:", len(emotes))

body = {"source": "Marvel Snap Zone (marvelsnapzone.com)", "seasons": dict(sorted(seasons.items())), "cardbacks": backs, "titles": titles, "emotes": emotes}
if {k: v for k, v in prev.items() if k != "updated"} == body: print("No changes."); sys.exit(0)
body["updated"] = datetime.now(timezone.utc).isoformat()
json.dump(body, open("art.json", "w"), ensure_ascii=False, separators=(",", ":"))
