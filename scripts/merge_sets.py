#!/usr/bin/env python3
"""Merge site/sets.json and metadata/sets.csv into metadata/sets_merged.csv
Prefer rows from metadata/sets.csv when short_code duplicates exist.
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE_SETS = ROOT / 'site' / 'sets.json'
META_SETS = ROOT / 'metadata' / 'sets.csv'
OUT = ROOT / 'metadata' / 'sets_merged.csv'

meta_rows = {}
fields = ['short_code','set_code','set_name','pack_art','has_alt_images','has_foils','has_tribbles']

# Load from site/sets.json
if SITE_SETS.exists():
    with SITE_SETS.open('r', encoding='utf-8') as f:
        data = json.load(f)
        for entry in data:
            sc = entry.get('short_code') or entry.get('shortCode') or entry.get('short') or entry.get('short_code')
            if not sc:
                continue
            row = {
                'short_code': sc,
                'set_code': entry.get('set_code','') or entry.get('setCode','') or '',
                'set_name': entry.get('set_name','') or entry.get('setName','') or '',
                'pack_art': entry.get('pack_art','') or entry.get('packArt','') or '',
                'has_alt_images': str(entry.get('has_alt_images','false')),
                'has_foils': str(entry.get('has_foils','false')),
                'has_tribbles': str(entry.get('has_tribbles','false')),
            }
            meta_rows[sc] = row

# Load metadata/sets.csv if present and prefer its entries
if META_SETS.exists():
    with META_SETS.open(newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            sc = (r.get('short_code') or r.get('shortCode') or r.get('short') or '').strip()
            if not sc:
                continue
            row = {k: (r.get(k) or '').strip() for k in fields}
            meta_rows[sc] = row

# Write merged CSV
OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open('w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=fields)
    writer.writeheader()
    for sc, row in sorted(meta_rows.items()):
        writer.writerow({k: row.get(k,'') for k in fields})

print('Wrote', OUT)
