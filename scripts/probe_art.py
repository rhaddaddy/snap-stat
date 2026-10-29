# One-off: save the title list pages so the app can read every title.
import os, urllib.request
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"}
os.makedirs("probe", exist_ok=True)
for name, u in [("msz_titles.html", "https://marvelsnapzone.com/titles/"), ("sf_titles.html", "https://snap.fan/titles/"), ("msz_titles2.html", "https://marvelsnapzone.com/titles/?pg=2")]:
    try: open("probe/" + name, "wb").write(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read())
    except Exception as e: open("probe/" + name + ".err", "w").write(str(e))
print(os.listdir("probe"))
