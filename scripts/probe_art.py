# One-off look at location, season, variant-gallery and promo-code sources (round 6). Results go to the probe-results branch.
import io, json, os, re, urllib.request
from PIL import Image
os.makedirs("probe", exist_ok=True)
UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36"
out = {}
def get(url, binary=False):
    r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40)
    b = r.read(); return (b, dict(r.headers)) if binary else b.decode("utf-8", "replace")
def img(url, save=None):
    try:
        b, h = get(url, True); im = Image.open(io.BytesIO(b))
        if save: im.convert("RGBA").save(f"probe/{save}.png")
        return {"size": im.size, "mode": im.mode, "frames": getattr(im, "n_frames", 1), "acao": h.get("Access-Control-Allow-Origin") or h.get("access-control-allow-origin"), "bytes": len(b)}
    except Exception as e: return {"err": str(e)[:60]}
def urls(page, pat=r'https://[^"\'\s)\\]+\.(?:webp|png|jpg|jpeg)'): return sorted(set(re.findall(pat, page)))
def tryget(k, url, n=60000):
    try: p = get(url); out[k + "_urls"] = urls(p)[:80]; out[k + "_og"] = re.findall(r'og:image" content="([^"]+)"', p)[:3]; return p
    except Exception as e: out[k + "_err"] = str(e)[:80]; return ""

# Locations
tryget("msz_loc", "https://marvelsnapzone.com/locations/altar-of-death/")
tryget("sf_loc", "https://snap.fan/locations/AltarOfDeath/")
for u in ["https://static.marvelsnap.pro/locations/AltarOfDeath.webp", "https://static.marvelsnap.pro/locations/AltarOfDeath_bg.webp", "https://static.marvelsnap.pro/art/locations/AltarOfDeath.webp",
          "https://static.marvelsnap.pro/backgrounds/AltarOfDeath.webp", "https://static.marvelsnap.pro/locations/512/AltarOfDeath.webp"]:
    out.setdefault("loc_guess", {})[u] = img(u)
for u in (out.get("sf_loc_urls") or [])[:12] + (out.get("msz_loc_urls") or [])[:12]:
    if "ltar" in u or "ocation" in u: out.setdefault("loc_imgs", {})[u] = img(u, "loc_" + str(len(out.get("loc_imgs", {}))))
# Seasons
sl = tryget("sf_seasons", "https://snap.fan/seasons/")
sp = tryget("sf_season", "https://snap.fan/seasons/september2026/")
for u in (out.get("sf_season_urls") or [])[:40]:
    if re.search(r"season|Season|loading|Loading|Key|key|banner|Banner|splash|Splash", u): out.setdefault("season_imgs", {})[u] = img(u, "season_" + str(len(out.get("season_imgs", {}))))
tryget("msz_season", "https://marvelsnapzone.com/seasons/")
out["sf_seasons_list_sample"] = sl[sl.find("/seasons/september2026/") - 1500: sl.find("/seasons/september2026/") + 1500] if "/seasons/september2026/" in sl else sl[:2000]
# Variant gallery block on a card page (does it carry the picture?)
cp = tryget("sf_card", "https://snap.fan/cards/SpiderMan/")
blocks = cp.split('<li class="group overflow-hidden')
out["sf_card_block"] = blocks[2][:2500] if len(blocks) > 2 else ""
up = tryget("sf_upcoming", "https://snap.fan/variants/upcoming/")
out["sf_upcoming_sample"] = up[:3000]
# Spider-Man faces
for v in ["SpiderMan_avatar", "SpiderMan_02_avatar", "SpiderMan_15_avatar", "Psylocke_avatar"]:
    out.setdefault("avatars", {})[v] = img(f"https://static.marvelsnap.pro/avatars/{v}.webp", "av_" + v)
# Promo codes
for k, u in [("dexerto", "https://www.dexerto.com/marvel-snap/marvel-snap-codes-3361570/"), ("popverse", "https://www.thepopverse.com/gaming-marvel-snap-codes-nuverse-second-dinner-active-new/"), ("msz_promo", "https://marvelsnapzone.com/promo-codes/")]:
    p = tryget(k, u)
    i = p.find("CREDITFIX") if "CREDITFIX" in p else p.find("NEWYEARNEWSNAP")
    out[k + "_sample"] = p[max(0, i - 2500): i + 4000] if i >= 0 else p[:1500]
json.dump(out, open("probe/result6.json", "w"), indent=1)
print({k: (len(v) if isinstance(v, (list, dict, str)) else v) for k, v in out.items()})
