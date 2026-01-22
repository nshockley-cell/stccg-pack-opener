#!/usr/bin/env python3
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
IMAGES_ROOTS = [ROOT / "images", SITE / "images"]

cards_path = SITE / "cards.json"

missing = []
by_set_missing = {}

with open(cards_path, "r") as f:
    cards = json.load(f)

for card in cards:
    fn = card.get("File Name")
    if not fn:
        continue
    # Normalize absolute path candidates under both image roots
    candidates = []
    for base in IMAGES_ROOTS:
        candidates.append(base / Path(fn.replace("images/", "")))
    # Try fallback STD->SD2
    if "/STD/" in fn:
        for base in IMAGES_ROOTS:
            # folder swap
            candidates.append(base / Path(fn.replace("images/STD/", "SD2/")))
            # filename prefix swap STD-### -> SD2-###
            import re
            m = re.search(r"images/STD/STD-(\d+)", fn)
            if m:
                num = m.group(1)
                candidates.append(base / Path(f"SD2/SD2-{num}.jpeg"))
                candidates.append(base / Path(f"SD2/SD2-{num}.jpg"))
                candidates.append(base / Path(f"SD2/SD2-{num}.png"))
    # Try extension swaps
    p = Path(fn)
    if p.suffix.lower() == ".jpeg":
        for base in IMAGES_ROOTS:
            candidates.append(base / Path(str(p).replace("images/", "").replace(".jpeg", ".jpg")))
            candidates.append(base / Path(str(p).replace("images/", "").replace(".jpeg", ".png")))
            # Try dotless extension variant (malformed filename): remove dot before jpeg
            candidates.append(base / Path(str(p).replace("images/", "").replace(".jpeg", "jpeg")))
    # Try removing known suffixes like -ai, -trib
    for suf in ("-ai", "-trib"):
        if suf in fn:
            basefn = fn.replace(suf, "")
            p2 = Path(basefn)
            for base in IMAGES_ROOTS:
                candidates.append(base / Path(str(p2).replace("images/", "")))
                if p2.suffix.lower() == ".jpeg":
                    candidates.append(base / Path(str(p2).replace("images/", "").replace(".jpeg", ".jpg")))
                    candidates.append(base / Path(str(p2).replace("images/", "").replace(".jpeg", ".png")))

    if not any(c.exists() for c in candidates):
        missing.append(fn)
        set_code = fn.split("/")[1] if "/" in fn else "UNKNOWN"
        by_set_missing.setdefault(set_code, 0)
        by_set_missing[set_code] += 1

print(f"Total cards: {len(cards)}")
print(f"Missing images: {len(missing)}")
for set_code, count in sorted(by_set_missing.items()):
    print(f"  {set_code}: {count}")

if missing:
    out = ROOT / "scripts" / "missing_images.txt"
    with open(out, "w") as f:
        for m in missing:
            f.write(m + "\n")
    print(f"Wrote list to {out}")
else:
    print("No missing images detected.")
