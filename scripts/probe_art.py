# One-off: test face finders on card art (the full art, not the game's tight portraits).
import json, os, random, time, urllib.request, io, traceback
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"}
os.makedirs("probe", exist_ok=True)
def get(u, t=40, hdr=None):
    return urllib.request.urlopen(urllib.request.Request(u, headers={**UA, **(hdr or {})}), timeout=t)
log = open("probe/log.txt", "w")
def say(*a): print(*a); print(*a, file=log); log.flush()
cd = json.load(open("card-data.json"))
cards = {c["id"]: c for c in cd["cards"] if c.get("status") == "released"}
from PIL import Image, ImageDraw, ImageFont
def font(n):
    try: return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", n)
    except Exception: return ImageFont.load_default()
# 4. Face finders on card art
random.seed(7)
ids = ["SpiderMan"] + [f"SpiderMan_{v['order']:02d}" for v in cards["SpiderMan"]["variants"]]
for cid in ["Deadpool", "Venom", "Hulk", "IronMan", "Carnage", "Groot", "Galactus", "Wolverine", "Nova", "X23", "BuckyBarnes", "Annihilus", "Sentinel", "GhostRider", "HumanTorch", "Thanos", "Knull", "Death", "Rocket", "Hela", "Mystique", "Storm", "Odin", "Gambit"]:
    if cid in cards:
        ids.append(cid); vs = cards[cid]["variants"]
        for v in random.sample(vs, min(2, len(vs))): ids.append(f"{cid}_{v['order']:02d}")
ids = ids[:80]
imgs = {}
for i in ids:
    try: imgs[i] = Image.open(io.BytesIO(get(f"https://static.marvelsnap.pro/art/{i}.webp", 30).read())).convert("RGB")
    except Exception as e: say("art ERR", i, e)
say("art loaded", len(imgs))
res = {i: {} for i in imgs}
try:
    import torch
    from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
    t0 = time.time()
    proc = AutoProcessor.from_pretrained("IDEA-Research/grounding-dino-tiny"); model = AutoModelForZeroShotObjectDetection.from_pretrained("IDEA-Research/grounding-dino-tiny")
    say("dino loaded", round(time.time() - t0, 1))
    t0 = time.time()
    for i, im in imgs.items():
        small = im.copy(); small.thumbnail((512, 512))
        inp = proc(images=small, text="a face. a head.", return_tensors="pt")
        with torch.no_grad(): out = model(**inp)
        r = proc.post_process_grounded_object_detection(out, inp.input_ids, threshold=0.25, text_threshold=0.2, target_sizes=[small.size[::-1]])[0]
        bx = [[float(v) / small.size[k % 2] for k, v in enumerate(b)] for b in r["boxes"].tolist()]
        res[i]["dino"] = sorted([{"b": b, "s": float(s), "l": str(l)} for b, s, l in zip(bx, r["scores"].tolist(), r.get("text_labels", r.get("labels")))], key=lambda x: -x["s"])[:4]
    say("dino per image", round((time.time() - t0) / max(1, len(imgs)), 2))
except Exception as e: say("dino ERR", traceback.format_exc()[-1500:])
try:
    import torch
    from transformers import Owlv2Processor, Owlv2ForObjectDetection
    t0 = time.time()
    proc2 = Owlv2Processor.from_pretrained("google/owlv2-base-patch16-ensemble"); model2 = Owlv2ForObjectDetection.from_pretrained("google/owlv2-base-patch16-ensemble")
    say("owl loaded", round(time.time() - t0, 1)); t0 = time.time()
    for i, im in imgs.items():
        inp = proc2(text=[["a face", "a head", "a masked face", "a helmet"]], images=im, return_tensors="pt")
        with torch.no_grad(): out = model2(**inp)
        W = max(im.size)  # owlv2 pads to a square
        r = proc2.post_process_object_detection(out, threshold=0.15, target_sizes=torch.tensor([[W, W]]))[0]
        bx = [[float(v) / im.size[k % 2] for k, v in enumerate(b)] for b in r["boxes"].tolist()]
        res[i]["owl"] = sorted([{"b": b, "s": float(s), "l": int(l)} for b, s, l in zip(bx, r["scores"].tolist(), r["labels"].tolist())], key=lambda x: -x["s"])[:4]
    say("owl per image", round((time.time() - t0) / max(1, len(imgs)), 2))
except Exception as e: say("owl ERR", traceback.format_exc()[-1500:])
json.dump(res, open("probe/faces.json", "w"), indent=0)
cell = 300; cols = 4
items = list(imgs.items())
for s in range(0, len(items), 16):
    chunk = items[s:s + 16]; rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 22)), (20, 16, 42)); g = ImageDraw.Draw(sheet)
    for k, (i, im) in enumerate(chunk):
        X, Y = (k % cols) * cell, (k // cols) * (cell + 22)
        t = im.copy(); t.thumbnail((cell, cell)); ox, oy = X + (cell - t.width) // 2, Y + (cell - t.height) // 2
        sheet.paste(t, (ox, oy))
        for key, col in [("dino", (0, 255, 0)), ("owl", (255, 60, 60))]:
            for n, d in enumerate(res[i].get(key, [])[:2]):
                b = d["b"]; g.rectangle([ox + b[0] * t.width, oy + b[1] * t.height, ox + b[2] * t.width, oy + b[3] * t.height], outline=col if n == 0 else tuple(c // 2 for c in col), width=3 if n == 0 else 1)
        g.text((X + 4, Y + cell + 3), i, fill=(255, 216, 77), font=font(14))
    sheet.save(f"probe/faces_{s // 16 + 1:02d}.jpg", quality=82)
say("done")
