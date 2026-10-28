# One-off: fetch a few of snap.fan's animated border previews whose frames didn't come out right (round 5).
import os, urllib.request
os.makedirs("probe", exist_ok=True)
for b in ["BorderBrains", "BorderBrainsGreen", "BorderCandyCane_Halloween", "BorderStickerHalloween", "WebPink", "DistressedGreen", "CosmicPurple", "Common"]:
    try:
        d = urllib.request.urlopen(urllib.request.Request(f"https://game-assets.snap.fan/ConvertedRenders/Borders/{b}.webp", headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read()
        open(f"probe/full_{b}.webp", "wb").write(d); print(b, len(d))
    except Exception as e: print(b, e)
