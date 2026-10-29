# One-off: save the raw card back pictures that need their stray text painted out, so the clean-up can be tuned.
import json, os, re, urllib.request
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"}
os.makedirs("probe", exist_ok=True)
def get(u):
    try: return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read()
    except Exception: return b""
page = get("https://snap.fan/card-backs/").decode("utf-8", "replace")
sf = {m.group(1): m.group(0) for m in re.finditer(r'https://game-assets\.snap\.fan/card_back_images/([A-Za-z0-9_]+)-[0-9a-f]{16,}\.webp', page)}
for cid in ["AntiPolarMagneto_01", "SuperiorIronMan_01", "SuperiorIronMan_02", "ZombieVenom_01", "SpiderManBrandNewDay_01", "Fud_03"]:
    open(f"probe/{cid}.msz.webp", "wb").write(get(f"https://static.marvelsnap.pro/cardbacks/{cid}.webp"))
    if cid in sf: open(f"probe/{cid}.sf.webp", "wb").write(get(sf[cid]))
print(os.listdir("probe"))
