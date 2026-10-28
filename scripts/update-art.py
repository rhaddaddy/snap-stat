# Builds art.json: each season's key art (the picture the game shows while it loads that season) and every card back,
# both from Marvel Snap Zone. The pictures stay on their servers; this only lists where they are.
#   seasons:   { "2026-09": { "img": ..., "title": "Axis: Inversion", "link": ... } }   keyed by the month the season starts
#   cardbacks: [ { "id": "ArthurPendragon_01", "name": ..., "added": ..., "img": ... } ]
# Run by .github/workflows/update-cards.yml.
import html, json, re, sys, urllib.request
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

body = {"source": "Marvel Snap Zone (marvelsnapzone.com)", "seasons": dict(sorted(seasons.items())), "cardbacks": backs}
if {k: v for k, v in prev.items() if k != "updated"} == body: print("No changes."); sys.exit(0)
body["updated"] = datetime.now(timezone.utc).isoformat()
json.dump(body, open("art.json", "w"), ensure_ascii=False, separators=(",", ":"))
