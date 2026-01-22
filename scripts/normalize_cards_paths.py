#!/usr/bin/env python3
"""Normalize File Name entries in metadata/Cards - Virtual Cards.csv and write to metadata/cards.csv

If a File Name does not include a directory, this will prefix it with images/<Set Code>/
"""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / 'metadata' / 'Cards - Virtual Cards.csv'
OUTPUT = ROOT / 'metadata' / 'cards.csv'

if not INPUT.exists():
    print('Input not found:', INPUT)
    raise SystemExit(1)

with INPUT.open(newline='', encoding='utf-8') as inf:
    reader = csv.DictReader(inf)
    rows = list(reader)
    fieldnames = reader.fieldnames

# Ensure 'File Name' present
if 'File Name' not in (fieldnames or []):
    print('No "File Name" column found in', INPUT)
    raise SystemExit(1)

out_rows = []
for r in rows:
    fn = (r.get('File Name') or '').strip()
    set_code = (r.get('Set Code') or r.get('SetCode') or '').strip()
    if fn and '/' not in fn and not fn.lower().startswith('images') and set_code:
        r['File Name'] = f'images/{set_code}/{fn}'
    elif fn and fn.lower().startswith('images/'):
        # leave as-is
        r['File Name'] = fn
    elif fn:
        # leave other cases
        r['File Name'] = fn
    out_rows.append(r)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with OUTPUT.open('w', newline='', encoding='utf-8') as outf:
    writer = csv.DictWriter(outf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(out_rows)

print('Wrote', OUTPUT)
