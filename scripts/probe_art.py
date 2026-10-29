# One-off: where is a full list of MARVEL SNAP titles (the phrases you collect)?
import json, os, re, urllib.request
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"}
os.makedirs("probe", exist_ok=True); out = {}
def get(u):
    try: r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40); return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e: return e.code, ""
    except Exception as e: return -1, str(e)
for u in ["https://marvelsnapzone.com/titles/", "https://marvelsnapzone.com/collection/titles/", "https://marvelsnapzone.com/collection/embed/", "https://snap.fan/titles/", "https://snap.fan/cosmetics/titles/", "https://snap.fan/cosmetics/", "https://marvelsnapzone.com/avatars/", "https://snap.fan/avatars/"]:
    st, p = get(u)
    i = max(p.find("msz-cat-i"), 0) if "marvelsnapzone" in u else max(p.find("card-grid__cell"), 0)
    out[u] = {"status": st, "len": len(p), "count_msz": p.count("msz-cat-i "), "count_sf": p.count("card-grid__cell\""), "title": (re.search(r"<title>([^<]*)", p) or [None, ""])[1], "snip": p[i:i + 2500], "links": sorted(set(re.findall(r'href="(/[^"]*(?:title|avatar|cosmetic)[^"]*)"', p, re.I)))[:30]}
json.dump(out, open("probe/result.json", "w"), indent=1)
print({k: (v["status"], v["len"], v["count_msz"], v["count_sf"]) for k, v in out.items()})
