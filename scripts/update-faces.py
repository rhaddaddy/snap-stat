# Builds faces.json: where each card's (and each variant's) face sits in its full art, so SNAP Stat can frame profile
# pictures and deck icons on the whole face, centred, without the card's name the game prints across its portraits.
#   faces: { "SpiderMan_05": [left, top, right, bottom, width/height] }   the portrait's box in the art, as fractions
# How: the game's face portrait (static.marvelsnap.pro/avatars/<id>_avatar.webp) is usually a crop of the full art
# (static.marvelsnap.pro/art/<id>.webp), so the middle of the portrait is looked for in the art at different sizes.
# Where the portrait was drawn separately, a head finder (Grounding DINO, run with "dino") looks for the head instead.
# Results are kept (faces-log.json has how each was found), so each run only does new art. Run by .github/workflows/update-faces.yml.
import io, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import numpy as np, cv2
from PIL import Image

UA = {"User-Agent": "Mozilla/5.0 (compatible; SNAP-Stat-faces/1.0; +https://github.com/rhaddaddy/snap-stat)"}
HOST = "https://static.marvelsnap.pro/"
MODE = sys.argv[1] if len(sys.argv) > 1 else "match"
BUDGET = float(os.environ.get("FACE_BUDGET_MIN", "40")) * 60
MATCH_OK = 0.72
T0 = time.time()

def get(u):
    try: return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read()
    except Exception: return b""

try: prev = json.load(open("faces.json"))
except Exception: prev = {}
try: work = json.load(open("faces-log.json"))  # how each was found, and the ones that weren't (tried again after 30 days)
except Exception: work = {}
faces, how, misses = dict(prev.get("faces") or {}), dict(work.get("how") or {}), dict(work.get("misses") or {})

cd = json.load(open("card-data.json"))
ids = []
for c in cd.get("cards", []):
    if c.get("status") != "released" or not c.get("id"): continue
    ids.append(c["id"])
    ids += [f'{c["id"]}_{int(v["order"]):02d}' for v in c.get("variants", []) if str(v.get("order", "")).isdigit()]
now = datetime.now(timezone.utc).timestamp()

def save():
    json.dump({"how": dict(sorted(how.items())), "misses": dict(sorted(misses.items()))}, open("faces-log.json", "w"), separators=(",", ":"))
    body = {"source": "Face portraits and art from Marvel Snap Zone (static.marvelsnap.pro)", "faces": dict(sorted(faces.items()))}
    if {k: v for k, v in prev.items() if k != "updated"} == body: return False
    body["updated"] = datetime.now(timezone.utc).isoformat()
    json.dump(body, open("faces.json", "w"), separators=(",", ":")); return True

# ---------- Matching the portrait against the art ----------
TB = (0.22, 0.12, 0.78, 0.56)  # the part of the portrait to look for: inside its hexagon, above the card's name
def gray(im, w):
    h = max(1, round(im.height * w / im.width))
    return cv2.cvtColor(np.asarray(im.convert("RGB").resize((w, h), Image.LANCZOS)), cv2.COLOR_RGB2GRAY)

def search(A, tpl, fracs):
    ah, aw = A.shape; best = (-1.0, None)
    for frac in fracs:
        tw = int(aw * frac * (TB[2] - TB[0]))
        if tw < 18 or tw >= aw: continue
        T = gray(tpl, tw)
        if T.shape[0] >= ah or T.shape[0] < 12: continue
        r = cv2.matchTemplate(A, T, cv2.TM_CCOEFF_NORMED); _, mx, _, loc = cv2.minMaxLoc(r)
        if mx > best[0]: best = (float(mx), (loc[0] / aw, loc[1] / ah, T.shape[1] / aw, T.shape[0] / ah, frac))
    return best

def match(i):
    art_b, av_b = get(f"{HOST}art/{i}.webp"), get(f"{HOST}avatars/{i}_avatar.webp")
    if not art_b: return i, None, "noart"
    if not av_b: return i, None, "noportrait"
    try:
        art = Image.open(io.BytesIO(art_b)).convert("RGB"); av = Image.open(io.BytesIO(av_b)).convert("RGBA")
    except Exception: return i, None, "bad"
    bg = Image.new("RGBA", av.size, (0, 0, 0, 255)); bg.alpha_composite(av); av = bg.convert("RGB")
    W, H = av.size; tpl = av.crop((int(TB[0] * W), int(TB[1] * H), int(TB[2] * W), int(TB[3] * H)))
    sc, b = search(gray(art, 320), tpl, np.geomspace(0.25, 1.2, 22))
    if sc < 0.8:  # a small face: look again with a sharper copy of the art
        sc2, b2 = search(gray(art, 640), tpl, np.geomspace(0.06, 0.32, 18))
        if sc2 > sc: sc, b = sc2, b2
    if not b: return i, None, f"miss:{sc:.2f}"
    x, y, tw, th, _ = b
    pw, ph = tw / (TB[2] - TB[0]), th / (TB[3] - TB[1])
    box = [x - TB[0] * pw, y - TB[1] * ph, x - TB[0] * pw + pw, y - TB[1] * ph + ph]
    ar = art.width / art.height
    if sc < MATCH_OK: return i, None, f"miss:{sc:.2f}"
    return i, [round(v, 4) for v in box] + [round(ar, 3)], f"m:{sc:.2f}"

if MODE == "match":
    todo = [i for i in ids if i not in faces and not (i in misses and now - float(misses[i].get("at", 0)) < 30 * 86400)]
    print(len(ids), "pictures,", len(faces), "done,", len(todo), "to match")
    n = 0
    with ThreadPoolExecutor(6) as ex:
        for i, box, why in ex.map(match, todo):
            n += 1
            if box: faces[i] = box; how[i] = why; misses.pop(i, None)
            elif why != "noart": misses[i] = {"at": now, "why": why}
            if n % 200 == 0: print(n, "matched so far,", round(time.time() - T0), "s"); save()
            if time.time() - T0 > BUDGET: print("Out of time; the rest next run."); break
    print("faces:", len(faces), "· not matched:", len(misses))

# ---------- A head finder for portraits that aren't a crop of the art ----------
if MODE == "dino":
    try:
        import torch
        from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
    except Exception as e: print("No head finder:", e); save(); sys.exit(0)
    proc = AutoProcessor.from_pretrained("IDEA-Research/grounding-dino-tiny")
    model = AutoModelForZeroShotObjectDetection.from_pretrained("IDEA-Research/grounding-dino-tiny"); torch.set_num_threads(4)
    todo = [i for i, m in misses.items() if not m.get("dino") and i not in faces and str(m.get("why", "")) != "noart"]
    print(len(todo), "for the head finder")
    for k, i in enumerate(todo):
        if time.time() - T0 > BUDGET: print("Out of time; the rest next run."); break
        b = get(f"{HOST}art/{i}.webp")
        try: im = Image.open(io.BytesIO(b)).convert("RGB")
        except Exception: misses[i]["dino"] = True; continue
        small = im.copy(); small.thumbnail((448, 448))
        inp = proc(images=small, text="a face. a head.", return_tensors="pt")
        with torch.no_grad(): out = model(**inp)
        r = proc.post_process_grounded_object_detection(out, inp.input_ids, threshold=0.25, text_threshold=0.2, target_sizes=[small.size[::-1]])[0]
        cands = []
        for bx, s in zip(r["boxes"].tolist(), r["scores"].tolist()):
            x0, y0, x1, y1 = bx[0] / small.width, bx[1] / small.height, bx[2] / small.width, bx[3] / small.height
            w, h = x1 - x0, y1 - y0
            if w <= 0.02 or h <= 0.02 or w * h > 0.2 or w > 0.55 or h > 0.55: continue  # the whole figure, not the head
            cands.append((s, x0, y0, x1, y1))
        misses[i]["dino"] = True
        if not cands: continue
        s, x0, y0, x1, y1 = max(cands)
        if s < 0.3: continue
        # A portrait-sized box round the head: about 2.3 heads wide, with the face a little above the middle
        hd = max(x1 - x0, (y1 - y0)); pw = min(1.0, hd * 2.3); ph = pw / (2 / 3 ** 0.5)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        faces[i] = [round(cx - pw / 2, 4), round(cy - ph * 0.46, 4), round(cx + pw / 2, 4), round(cy + ph * 0.54, 4), round(im.width / im.height, 3)]
        how[i] = f"d:{s:.2f}"
        if (k + 1) % 25 == 0: print(k + 1, "heads looked for,", round(time.time() - T0), "s"); save()
    print("faces:", len(faces))
print("saved" if save() else "No changes.")
