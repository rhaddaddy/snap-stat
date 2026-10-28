# One-off look at season art, card backs and location art (round 7). Results go to the probe-results branch.
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
        if save: t = im.convert("RGBA"); t.thumbnail((512, 512)); t.save(f"probe/{save}.png")
        return {"size": im.size, "mode": im.mode, "acao": h.get("Access-Control-Allow-Origin"), "bytes": len(b)}
    except Exception as e: return {"err": str(e)[:60]}
# Seasons on Marvel Snap Zone: how each season and its picture appear
try:
    p = get("https://marvelsnapzone.com/seasons/")
    i = p.find("Axis-Inversion"); out["msz_seasons_axis"] = p[max(0, i - 2500): i + 1500]
    j = p.find("S031_PC_SplashScreen"); out["msz_seasons_old"] = p[max(0, j - 2000): j + 800]
    out["msz_season_links"] = sorted(set(re.findall(r'href="(https://marvelsnapzone\.com/[^"]*season[^"]*)"', p, re.I)))[:80]
except Exception as e: out["msz_seasons_err"] = str(e)
for u in ["https://marvelsnapzone.com/seasons/axis-inversion/", "https://marvelsnapzone.com/season/axis-inversion/"]:
    try: p = get(u); out["msz_season_page"] = {"url": u, "imgs": sorted(set(re.findall(r'https://[^"\'\s]+\.(?:webp|png|jpg)', p)))[:40], "og": re.findall(r'og:image" content="([^"]+)"', p)}; break
    except Exception as e: out.setdefault("msz_season_page_err", []).append(str(e)[:60])
# Card backs
for k, u in [("msz_cardbacks", "https://marvelsnapzone.com/cardbacks/"), ("msz_cardbacks2", "https://marvelsnapzone.com/card-backs/")]:
    try:
        p = get(u); out[k + "_urls"] = sorted(set(re.findall(r'https://static\.marvelsnap\.pro/[^"\'\s]+', p)))[:30]
        i = p.find("msz-cat-i"); out[k + "_sample"] = p[i: i + 2500]; out[k + "_count"] = re.findall(r'id="msz-count">(\d+)', p)
    except Exception as e: out[k + "_err"] = str(e)[:60]
for u in (out.get("msz_cardbacks_urls") or [])[:2]: out.setdefault("cb_imgs", {})[u] = img(u, "cb_" + str(len(out.get("cb_imgs", {}))))
# Location art
for n, u in [("loc_static", "https://static.marvelsnap.pro/locations/AltarOfDeath.webp"), ("loc_static2", "https://static.marvelsnap.pro/locations/Asgard.webp"), ("loc_msz", "https://marvelsnapzone.com/wp-content/themes/blocksy-child/assets/media/cards/altar-of-death.webp")]:
    out[n] = img(u, n)
json.dump(out, open("probe/result7.json", "w"), indent=1)
print({k: (len(v) if isinstance(v, (list, dict, str)) else v) for k, v in out.items()})
