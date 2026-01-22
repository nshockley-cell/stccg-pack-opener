#!/usr/bin/env python3
import json
import os
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
IMAGES_ROOTS = [ROOT / "images", SITE / "images"]
CARDS_JSON = SITE / "cards.json"

# Known suffixes to remove
SUFFIXES = ["-ai", "-trib"]

# Build an index of actual image files by basename (without extension) for quick matching
index = {}
for base in IMAGES_ROOTS:
    if not base.exists():
        continue
    for set_dir in base.iterdir():
        if not set_dir.is_dir():
            continue
        for f in set_dir.glob("*.*"):
            name = f.stem  # e.g., HAD-059, SD2-001, VOY-143.ai -> VOY-143
            index.setdefault(name, []).append(f)
            # Also index with suffix-stripped name
            for suf in SUFFIXES:
                if name.endswith(suf):
                    name2 = name[: -len(suf)]
                    index.setdefault(name2, []).append(f)

# Helper to find best candidate for a given expected path

def find_candidate(expected: str):
    # expected like images/SET/FILE.jpeg
    m = re.search(r"images/([A-Z0-9]+)/([A-Za-z0-9_.-]+)\.(jpeg|jpg|png)$", expected)
    if not m:
        # Handle cases where expected may have extension without dot, e.g., ...".jpeg" missing '.'
        # Try to split manually and recover
        parts = expected.split('/')
        if len(parts) >= 3 and parts[-1].lower().endswith('jpeg') and '.' not in parts[-1]:
            # insert dot before 'jpeg'
            fixed_expected = expected[:-4] + '.jpeg'
            m = re.search(r"images/([A-Z0-9]+)/([A-Za-z0-9_.-]+)\.(jpeg|jpg|png)$", fixed_expected)
            if not m:
                return None
        else:
            return None
    set_code, filename, ext = m.group(1), m.group(2), m.group(3)
    stem = Path(filename).stem  # remove extension if any
    # Special case: STD -> SD2 filename swap
    if set_code == "STD" and stem.startswith("STD-"):
        num_m = re.search(r"STD-(\d+)", stem)
        if num_m:
            num = num_m.group(1)
            alt_stem = f"SD2-{num}"
            # Prefer SD2 directory images
            for base in IMAGES_ROOTS:
                candidate = base / "SD2" / f"{alt_stem}.jpeg"
                if candidate.exists():
                    return f"images/SD2/{alt_stem}.jpeg"
                for e in ("jpg", "png"):
                    candidate = base / "SD2" / f"{alt_stem}.{e}"
                    if candidate.exists():
                        return f"images/SD2/{alt_stem}.{e}"
    # General lookup by stem with suffix removal and extension variants
    stems_to_try = {stem}
    for suf in SUFFIXES:
        if stem.endswith(suf):
            stems_to_try.add(stem[: -len(suf)])
    for s in stems_to_try:
        # Try within the same set directory first
        for base in IMAGES_ROOTS:
            for e in ("jpeg", "jpg", "png"):
                candidate = base / set_code / f"{s}.{e}"
                if candidate.exists():
                    return f"images/{set_code}/{s}.{e}"
                # Also try dotless extension (rare malformed filenames): s + e (no dot)
                dotless = base / set_code / f"{s}{e}"
                if dotless.exists():
                    return f"images/{set_code}/{s}{e}"
        # Fallback: any match by stem in index regardless of directory
        if s in index:
            # choose the first
            f = index[s][0]
            rel_set = f.parent.name
            return f"images/{rel_set}/{f.name}"
    return None

# Load cards.json
with open(CARDS_JSON, "r") as f:
    cards = json.load(f)

fixed = 0
for card in cards:
    fn = card.get("File Name")
    if not fn:
        continue
    # Check existence quickly
    exists = False
    for base in IMAGES_ROOTS:
        p = base / Path(fn.replace("images/", ""))
        if p.exists():
            exists = True
            break
    if exists:
        continue
    # Try to find a candidate
    cand = find_candidate(fn)
    if cand:
        card["File Name"] = cand
        fixed += 1

# Write back if changes
if fixed:
    backup = CARDS_JSON.with_suffix(".json.bak")
    if not backup.exists():
        backup.write_text(CARDS_JSON.read_text())
    with open(CARDS_JSON, "w") as f:
        json.dump(cards, f, indent=2)
    print(f"Updated cards.json: {fixed} entries fixed. Backup at {backup}")
else:
    print("No changes made; no fixable missing entries found.")
