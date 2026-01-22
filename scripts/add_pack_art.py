#!/usr/bin/env python3
"""Fill pack_art in metadata/sets_merged.csv when pack-art/<SHORT>.png exists.
Writes back to metadata/sets_merged.csv with updated pack_art paths.
"""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / 'metadata' / 'sets_merged.csv'
PACK_DIR = ROOT / 'pack-art'

if not INPUT.exists():
    print('Missing', INPUT)
    raise SystemExit(1)

rows = []
with INPUT.open(newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for r in reader:
        rows.append(r)

changed = 0
for r in rows:
    sc = (r.get('short_code') or '').strip()
    if not sc:
        continue
    current = (r.get('pack_art') or '').strip()
    if current:
        continue
    # check for files with common extensions
    for ext in ('png','jpg','jpeg','webp'):
        p = PACK_DIR / f"{sc}.{ext}"
        if p.exists():
            r['pack_art'] = f"pack-art/{sc}.{ext}"
            changed += 1
            break

if changed:
    with INPUT.open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

print('Updated', changed, 'pack_art entries in', INPUT)
