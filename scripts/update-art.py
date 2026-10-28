# Builds art.json: each season's key art (the picture the game shows while it loads that season) and every card back,
# both from Marvel Snap Zone. The pictures stay on their servers; this only lists where they are.
#   seasons:   { "2026-09": { "img": ..., "title": "Axis: Inversion", "link": ... } }   keyed by the month the season starts
#   cardbacks: [ { "id": "ArthurPendragon_01", "name": ..., "added": ..., "img": ... } ]
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
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))

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
    stand_in = flat > 0.86 and band < 0.3 or float(x.std()) < 6
    return {"detail": round(edges + float(x.std()) / 500, 4), "standIn": bool(stand_in)}

def paint_out_text(m_im, f_im):
    """Marvel Snap Zone's picture with the stand-in's text painted out, or None if it doesn't have that text."""
    W, H = m_im.size
    f8 = np.asarray(f_im.convert("RGB").resize((W, H), Image.LANCZOS)); k = max(15, (W // 14) | 1)
    r = np.abs(f8.astype(np.float32) - cv2.medianBlur(f8, k).astype(np.float32)).mean(2)  # the text, against the stand-in's plain background
    mask = (r >= 14).astype(np.uint8)
    mask[: int(H * .09)] = 0; mask[int(H * .91):] = 0; mask[:, : int(W * .11)] = 0; mask[:, int(W * .89):] = 0  # leave the frame alone
    if mask.sum() < 50: return None
    ys, xs = np.nonzero(mask)
    if (ys.max() - ys.min()) > H * 0.25: return None  # more than a line of text: not a text stand-in
    near = cv2.dilate(mask, np.ones((max(3, W // 40),) * 2, np.uint8))
    m = np.asarray(m_im.convert("RGB"), dtype=np.float32)
    hsv = cv2.cvtColor(m.astype(np.uint8), cv2.COLOR_RGB2HSV)
    texty = (m.mean(2) > 165) & (hsv[..., 1] < 70)
    hit = float((texty & (near > 0)).sum()) / max(1, int(near.sum()))
    if hit < 0.08: return None
    fix = cv2.dilate((texty & (near > 0)).astype(np.uint8) * 255, np.ones((max(3, W // 80),) * 2, np.uint8))
    out = cv2.inpaint(cv2.cvtColor(m.astype(np.uint8), cv2.COLOR_RGB2BGR), fix, max(3, W // 100), cv2.INPAINT_TELEA)
    im = Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB)).convert("RGBA"); im.putalpha(m_im.split()[3]); return im

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
        if old and old.get("sf") == f_url and (age < 7 or old.get("use") == "msz" and age < 30):
            use = old.get("use")
        else:
            m_im, f_im = card_crop(get_bytes(m_url)), card_crop(get_bytes(f_url)) if f_url else None
            mq, fq = (look(m_im) if m_im else None), (look(f_im) if f_im else None)
            use = "none"
            if mq and not mq["standIn"] and not (fq and not fq["standIn"] and fq["detail"] > mq["detail"] * 1.5): use = "msz"
            elif fq and not fq["standIn"]: use = "sf"
            if use == "msz" and f_im is not None and fq and fq["standIn"]:
                fixed = paint_out_text(m_im, f_im)
                if fixed is not None: fixed.save(f"cardbacks/{cid}.webp", "WEBP", quality=84, method=6); use = "fixed"
            if use != "fixed" and os.path.exists(f"cardbacks/{cid}.webp"): os.remove(f"cardbacks/{cid}.webp")
            checked[cid] = {"use": use, "sf": f_url, "at": datetime.now(timezone.utc).timestamp(), "m": mq, "f": fq}
        tally[use] = tally.get(use, 0) + 1
        b["img"] = m_url if use == "msz" else f_url if use == "sf" else f"cardbacks/{cid}.webp" if use == "fixed" else ""
        if use == "none": b["noArt"] = True
        else: b.pop("noArt", None)
    json.dump(checked, open("cardbacks/checked.json", "w"), indent=0, sort_keys=True)
    print("card back pictures:", tally)

body = {"source": "Marvel Snap Zone (marvelsnapzone.com)", "seasons": dict(sorted(seasons.items())), "cardbacks": backs}
if {k: v for k, v in prev.items() if k != "updated"} == body: print("No changes."); sys.exit(0)
body["updated"] = datetime.now(timezone.utc).isoformat()
json.dump(body, open("art.json", "w"), ensure_ascii=False, separators=(",", ":"))
