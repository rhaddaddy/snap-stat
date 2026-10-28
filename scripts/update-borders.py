# Builds borders.json and the frame pictures for every Custom Card border, for profile pictures and banners.
#   The list (names, rarity, where each comes from) is Marvel Snap Zone's border page.
#   Moving borders: snap.fan's animated preview of each border on a card. The frame is cut out of each picture and
#     laid flat (borders/<id>.anim.webp, 24 pictures in a loop), with the first one as the still (borders/<id>.webp).
#   Others: Marvel Snap Zone's tilted 3D picture of the frame, laid flat (still only).
#   Borders with neither are drawn by the app from their colours.
# Run by .github/workflows/update-cards.yml. Needs Pillow and numpy.
import hashlib, io, json, os, re, statistics, sys, urllib.request
from datetime import datetime, timezone
import numpy as np
from PIL import Image, ImageDraw

UA = {"User-Agent": "Mozilla/5.0 (compatible; SNAP-Stat-border-updater/1.0; +https://github.com/rhaddaddy/snap-stat)"}
OUT_DIR = "borders"; os.makedirs(OUT_DIR, exist_ok=True)
W_OUT, H_OUT, R = 200, 250, 25  # the ring is 12.5% of the width and 10% of the height (the app's border-image slice)
ANIM = "https://game-assets.snap.fan/ConvertedRenders/Borders/{}.webp"


def get(url, binary=False, method="GET"):
    r = urllib.request.urlopen(urllib.request.Request(url, headers=UA, method=method), timeout=60)
    if method == "HEAD": return dict(r.headers)
    b = r.read()
    return b if binary else b.decode("utf-8", "replace")


def strip_tags(s): return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip()


# ---------- 1. The list ----------
borders, seen = [], set()
for pg in range(1, 8):
    try: html = get("https://marvelsnapzone.com/borders/" + (f"?pg={pg}" if pg > 1 else ""))
    except Exception as e: print("page", pg, "failed:", e); break
    new = 0
    for m in re.finditer(r'<a class="msz-cat-i[^"]*" href="/borders/([^/"]+)/">(.*?)</a>', html, re.S):
        bid, body = m.group(1), m.group(2)
        if bid in seen or not re.fullmatch(r"[A-Za-z0-9_]+", bid): continue
        seen.add(bid); new += 1
        g = lambda pat: (lambda mm: strip_tags(mm.group(1)) if mm else "")(re.search(pat, body, re.S))
        img = re.search(r'<img[^>]+src="([^"]+)"', body)
        borders.append({"id": bid, "name": g(r'msz-cat-i__name">(.*?)</span>') or bid, "rarity": g(r'msz-badge[^"]*">(.*?)</span>'),
                        "added": g(r'msz-cat-i__date">(.*?)</span>').replace("Added in ", ""), "source": g(r'msz-cat-i__src">(.*?)</span>'),
                        "img": img.group(1) if img else f"https://static.marvelsnap.pro/borders/{bid}.webp"})
    if not new: break
print(len(borders), "borders listed")
if len(borders) < 30: sys.exit("Too few borders found; leaving the old files alone.")

# snap.fan's names, where Marvel Snap Zone only has the id (e.g. "Champion" is the Grand Arena Border)
try:
    sf = get("https://snap.fan/cosmetics/borders/")
    for m in re.finditer(r'href="/cosmetics/borders/([A-Za-z0-9_]+)/"[^>]*>(.*?)</a>', sf, re.S):
        nm = strip_tags(m.group(2))
        for b in borders:
            if b["id"] == m.group(1) and nm and (b["name"] == b["id"] or not b["name"] or b["id"].startswith("Border")): b["name"] = nm[:60]
except Exception as e: print("snap.fan names:", e)

# Tidy names: "Faction_XMen" → "Faction · X Men", no "Border " in front, no source stuck on the end, and no two the same.
def spaced(x): return re.sub(r"([a-z])([A-Z])", r"\1 \2", x).replace("_", " ").strip()
for b in borders:
    n = b["name"]
    if n.startswith("Faction_"): n = "Faction · " + spaced(n[8:]).replace("XMen", "X-Men").replace(" Of ", " of ").replace(" The ", " the ")
    if n == b["id"]: n = spaced(n)
    n = re.sub(r"^Border ", "", n)
    if b["source"] and n.endswith(" " + b["source"]) and n != b["source"]: n = n[: -len(b["source"]) - 1]
    b["name"] = n.strip()
fam = lambda n: n.split(" · ")[0]
for b in borders:
    same = [x for x in borders if x["name"] == b["name"]]
    if len(same) > 1 or " · " not in b["name"] and re.match(r"^(Chromatic|Web|Fire|Neon|Cosmic|Distressed)[A-Z]", b["id"]):
        suffix = spaced(re.sub(r"^(Chromatic|Web|Fire|Neon|Cosmic|Distressed|Metallic|Matte|Snowflakes)", "", b["id"]))
        if suffix: b["name"] = fam(b["name"]) + " · " + suffix


# ---------- 2. Laying a frame flat ----------
def build(side_tex, top_tex):
    """A flat frame from a right-side texture (inner edge on its left) and a top texture (inner edge at its bottom)."""
    W, H = W_OUT, H_OUT
    right = side_tex.resize((R, H), Image.LANCZOS); left = right.transpose(Image.FLIP_LEFT_RIGHT)
    top = top_tex.resize((W, R), Image.LANCZOS); bottom = top.transpose(Image.FLIP_TOP_BOTTOM)
    parts = [(top, (0, 0), [(0, 0), (W, 0), (W - R, R), (R, R)]), (bottom, (0, H - R), [(R, H - R), (W - R, H - R), (W, H), (0, H)]),
             (left, (0, 0), [(0, 0), (R, R), (R, H - R), (0, H)]), (right, (W - R, 0), [(W, 0), (W, H), (W - R, H - R), (W - R, R)])]
    fr = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for im, at, poly in parts:
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0)); layer.paste(im.convert("RGBA"), at)
        m = Image.new("L", (W, H), 0); ImageDraw.Draw(m).polygon(poly, fill=255)
        a = Image.composite(layer.split()[3], Image.new("L", (W, H), 0), m); layer.putalpha(a)
        fr.alpha_composite(layer)
    return fr


def flatten_tilted(im):
    """Marvel Snap Zone's tilted frame picture: take the left side of the frame and use it all round."""
    im = im.convert("RGBA")
    a = im.split()[3].point(lambda v: 255 if v > 40 else 0)
    box = a.getbbox()
    if not box: return None
    im, a = im.crop(box), a.crop(box)
    w, h = im.size
    segs = []
    for y in range(int(h * 0.3), int(h * 0.7)):
        row = [a.getpixel((x, y)) for x in range(w)]
        try: x0 = row.index(255); x1 = row.index(0, x0)
        except ValueError: continue
        if 2 < x1 - x0 < w * 0.45: segs.append((y, x0, x1))
    if len(segs) < 8: return None
    bw = int(statistics.median(x1 - x0 for _, x0, x1 in segs))
    tex = Image.new("RGBA", (bw, len(segs)))
    for i, (y, x0, _) in enumerate(segs): tex.paste(im.crop((x0, y, x0 + bw, y + 1)), (0, i))
    side = tex.transpose(Image.FLIP_LEFT_RIGHT)  # inner edge on the left, like a right-hand side
    return build(side, side.rotate(90, expand=True))


def line_fit(ys, xs):
    """A straight edge through the detections (Theil-Sen, so a few wrong ones don't tilt it). The card is nearly upright."""
    ys, xs = np.asarray(ys, float), np.asarray(xs, float)
    if len(ys) < 6: return None
    i, j = np.triu_indices(len(ys), 1)
    dy = ys[j] - ys[i]; ok = np.abs(dy) > 4
    if not ok.any(): return None
    a = float(np.clip(np.median((xs[j] - xs[i])[ok] / dy[ok]), -0.06, 0.06))
    return a, float(np.median(xs - a * ys))


def bar_edges(a, axis, lo, hi, start, sign):
    """Scan from inside the card art (start) outwards. Returns [(position, inner edge, frame thickness)]."""
    out = []
    for p in range(lo, hi, 2):
        line = a[p] if axis == 0 else a[:, p]
        seg = line[start:] if sign > 0 else line[start::-1]
        if len(seg) < 40: continue
        ref = seg[:10].mean(0)
        d = np.abs(seg - ref).sum(1)
        hit = np.nonzero(d[4:120] > 110)[0]
        if not len(hit): continue
        i = int(hit[0]) + 4
        rest = seg[i:i + 96].astype(float); lum = rest.mean(1)
        if len(lum) < 12: continue
        pad = np.pad(lum, 2, mode="edge")
        std = np.array([pad[q:q + 5].std() for q in range(len(lum))])
        run = np.convolve(((lum < 75) & (std < 7)).astype(int), np.ones(6, int), "valid")  # the dark, smooth background
        k = np.nonzero(run == 6)[0]
        out.append((p, start + sign * i, int(k[0]) if len(k) else 40))
    return out


def flatten_anim(data):
    """snap.fan's animated preview (a card with the border, turning slightly): cut the frame out of 24 of its pictures."""
    im = Image.open(io.BytesIO(data)); n = getattr(im, "n_frames", 1)
    if n < 2: return None
    W, H = im.size
    frames = []
    for k in range(24):
        im.seek(round(k * n / 24) % n); frames.append(np.asarray(im.convert("RGB"), dtype=np.int16))
    rows = (int(H * .24), int(H * .42)); cols = (int(W * .28), int(W * .5))
    s0, t0 = bar_edges(frames[0], 0, *rows, int(W * .8), 1), bar_edges(frames[0], 1, *cols, int(H * .15), -1)
    if len(s0) < 20 or len(t0) < 20: return None
    ts = int(np.clip(np.median([t for _, _, t in s0]), 16, 70)); tt = int(np.clip(np.median([t for _, _, t in t0]), 16, 70))
    # Only previews laid out like the usual one (the frame where it normally is, and clearly different from the art) are used.
    side_at = np.median([i for _, i, _ in s0]) / W; top_at = np.median([i for _, i, _ in t0]) / H
    f0 = line_fit([p for p, _, _ in s0], [i for _, i, _ in s0])
    if not f0: return None
    con = []
    for y in range(rows[0], rows[1], 3):
        x = int(round(f0[0] * y + f0[1]))
        if x - 16 >= 0 and x + ts <= W: con.append(np.abs(frames[0][y, x - 16:x - 4].mean(0) - frames[0][y, x + 2:x + ts].mean(0)).sum())
    if not (0.845 <= side_at <= 0.92 and 0.075 <= top_at <= 0.15 and con and np.median(con) >= 40):
        print("  preview not usable:", f"side {side_at:.3f} top {top_at:.3f} contrast {np.median(con) if con else 0:.0f}"); return None
    out = []
    for a in frames:
        s, t = bar_edges(a, 0, *rows, int(W * .8), 1), bar_edges(a, 1, *cols, int(H * .15), -1)
        fs, ft = line_fit([p for p, _, _ in s], [i for _, i, _ in s]), line_fit([p for p, _, _ in t], [i for _, i, _ in t])
        if not fs or not ft: continue
        img = Image.fromarray(a.astype(np.uint8))
        stex = Image.new("RGB", (ts, rows[1] - rows[0]))
        for j, y in enumerate(range(*rows)):
            x = int(round(fs[0] * y + fs[1])); stex.paste(img.crop((x, y, x + ts, y + 1)), (0, j))
        ttex = Image.new("RGB", (cols[1] - cols[0], tt))
        for j, x in enumerate(range(*cols)):
            y = int(round(ft[0] * x + ft[1])); ttex.paste(img.crop((x, y - tt + 1, x + 1, y + 1)), (j, 0))
        out.append(build(stex, ttex))
    return out if len(out) >= 12 else None


def color_of(bid):
    words = re.sub(r"([a-z])([A-Z])", r"\1 \2", bid).lower().replace("_", " ").split()
    pal = {"aqua": "#2ee6d6", "teal": "#2ee6d6", "black": "#2a2733", "blue": "#3b82f6", "gold": "#f2c14e", "gilded": "#e9b949", "green": "#34d27a",
           "orange": "#ff8a2a", "pink": "#ff5fb4", "purple": "#9b5cff", "rainbow": "rainbow", "red": "#ef4444", "silver": "#cfd6e2", "white": "#f4f4f8",
           "yellow": "#ffe14d", "copper": "#d07a43", "grey": "#9aa0ab", "gray": "#9aa0ab", "pop": "rainbow"}
    for w in reversed(words):
        if w in pal: return pal[w]
    fac = {"avengers": "#3b6fe0", "brotherhood": "#c0303c", "guardians": "#ff8a2a", "thunderbolts": "#34d27a", "slingers": "#e23b3b", "xmen": "#f2c14e", "mutants": "#c0303c"}
    for w in words:
        if w in fac: return fac[w]
    return ""


def effect(bid):
    b = bid.lower()
    if b.startswith("fire"): return "fire"
    if b.startswith("neon"): return "neon"
    if b.startswith("cosmic"): return "cosmic"
    if b.startswith("chromatic") or "refraction" in b: return "shimmer"
    if b in ("infinity", "ultralegendary"): return "infinity"
    if b.startswith("snowflakes") or b.startswith("ice"): return "frost"
    if b in ("overloaded", "champion") or "glyphs" in b: return "glow"
    return ""


# ---------- 3. Each border, reusing last time's pictures when the source hasn't changed ----------
try: prev_src = json.load(open(f"{OUT_DIR}/sources.json"))
except Exception: prev_src = {}
src_log, out, report = {}, [], {"anim": [], "still": [], "drawn": [], "kept": []}
for b in borders:
    bid = b["id"]; item = {"id": bid, "name": b["name"], "rarity": b["rarity"], "source": b["source"], "added": b["added"], "frame": "", "anim": "", "fx": "", "c": color_of(bid)}
    still_p, anim_p = f"{OUT_DIR}/{bid}.webp", f"{OUT_DIR}/{bid}.anim.webp"
    # moving version first
    try: head = get(ANIM.format(bid), method="HEAD"); sig = "a2:" + str(head.get("Content-Length") or head.get("content-length")) + ":" + str(head.get("Last-Modified") or head.get("ETag") or "")
    except Exception: head, sig = None, ""
    if head and prev_src.get(bid) == sig and os.path.exists(anim_p) and os.path.exists(still_p):
        item.update(frame=still_p, anim=anim_p); src_log[bid] = sig; report["kept"].append(bid); out.append(item); continue
    done = False
    if head:
        try:
            frames = flatten_anim(get(ANIM.format(bid), True))
            if frames:
                frames[0].save(still_p, "WEBP", quality=82, method=6)
                frames[0].save(anim_p, "WEBP", save_all=True, append_images=frames[1:], duration=100, loop=0, quality=68, method=4)
                item.update(frame=still_p, anim=anim_p); src_log[bid] = sig; report["anim"].append(bid); done = True
        except Exception as e: print(bid, "animation failed:", e)
    if not done:
        for u in [b["img"], f"https://static.marvelsnap.pro/borders/{bid}.webp"]:
            try:
                fr = flatten_tilted(Image.open(io.BytesIO(get(u, True))))
                if fr is not None:
                    fr.save(still_p, "WEBP", quality=82, method=6); item["frame"] = still_p; done = True; report["still"].append(bid)
                    if os.path.exists(anim_p): os.remove(anim_p)
                    break
            except Exception: pass
    if not done:
        report["drawn"].append(bid)
        for f in (still_p, anim_p):
            if os.path.exists(f): os.remove(f)
    if not item["anim"]: item["fx"] = effect(bid)
    out.append(item)

# ---------- 4. A sheet to check them by eye, and the list ----------
pics = [(i["id"], Image.open(i["frame"]).convert("RGBA")) for i in out if i["frame"]]
if pics:
    cols, tw, th = 10, 100, 125
    sheet = Image.new("RGB", (cols * tw, ((len(pics) + cols - 1) // cols) * th), (30, 24, 60))
    for k, (bid, fr) in enumerate(pics):
        tile = Image.new("RGBA", (tw, th), (40, 120, 120, 255)); tile.alpha_composite(fr.resize((tw, th), Image.LANCZOS))
        sheet.paste(tile.convert("RGB"), ((k % cols) * tw, (k // cols) * th))
    sheet.save(f"{OUT_DIR}/preview.jpg", quality=78)
json.dump(src_log, open(f"{OUT_DIR}/sources.json", "w"), indent=0)
json.dump(report, open(f"{OUT_DIR}/report.json", "w"), indent=1)
body = {"source": "Marvel Snap Zone (marvelsnapzone.com) and snap.fan", "count": len(out), "borders": out}
try:
    prev = json.load(open("borders.json"))
    if prev.get("borders") == out: body["updated"] = prev.get("updated")
except Exception: pass
if not body.get("updated"): body["updated"] = datetime.now(timezone.utc).isoformat()
json.dump(body, open("borders.json", "w"), ensure_ascii=False, separators=(",", ":"))
print({k: len(v) for k, v in report.items()}, "drawn:", report["drawn"])
