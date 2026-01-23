#!/usr/bin/env python3
"""Convert cards/sets/images CSV files into JSON files under site/.

Usage:
  python3 scripts/convert_csv.py --cards PATH --sets PATH --images PATH

If a CSV path is not provided, the script will try a few common locations.
"""
import csv
import json
import argparse
import os
from pathlib import Path

def csv_to_list(path):
    rows = []
    path = Path(path)
    if not path.exists():
        return rows
    with path.open(newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            # normalize keys and strip whitespace from values
            clean = {k.strip(): (v.strip() if isinstance(v, str) else v) for k,v in r.items()}
            rows.append(clean)
    return rows

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--cards', help='Path to cards.csv')
    p.add_argument('--sets', help='Path to sets.csv')
    p.add_argument('--images', help='Path to images.csv')
    args = p.parse_args()

    # fallback locations to try
    cwd = Path.cwd()
    candidates = {
        'cards': [args.cards, cwd / 'cards.csv', cwd / 'metadata' / 'cards.csv', Path.home() / 'Desktop' / 'star-trek-ccg' / 'metadata' / 'cards.csv'],
        'sets': [args.sets, cwd / 'sets.csv', cwd / 'metadata' / 'sets.csv', Path.home() / 'Desktop' / 'star-trek-ccg' / 'metadata' / 'sets.csv'],
        'images': [args.images, cwd / 'images.csv', cwd / 'metadata' / 'images.csv', Path.home() / 'Desktop' / 'star-trek-ccg' / 'metadata' / 'images.csv'],
    }

    def pick_one(lst):
        for item in lst:
            if not item:
                continue
            p = Path(item)
            if p.exists():
                return p
        return None

    cards_path = pick_one(candidates['cards'])
    sets_path = pick_one(candidates['sets'])
    images_path = pick_one(candidates['images'])

    if not cards_path:
        print('No cards CSV found. Tried common locations. Provide --cards path.')
        return

    print('Reading cards from', cards_path)
    cards = csv_to_list(cards_path)
    print(f'Loaded {len(cards)} card rows')

    images = []
    images_map = {}
    if images_path:
        print('Reading images from', images_path)
        images = csv_to_list(images_path)
        for img in images:
            key = img.get('ID') or img.get('Id') or img.get('id')
            fn = img.get('File Name') or img.get('FileName') or img.get('file_name') or img.get('File')
            if key and fn:
                images_map[key] = fn
        print(f'Loaded {len(images)} image rows')

    sets = []
    if sets_path:
        print('Reading sets from', sets_path)
        sets = csv_to_list(sets_path)
        print(f'Loaded {len(sets)} set rows')

    # Merge image file names into cards if missing
    count_filled = 0
    for c in cards:
        if not c.get('File Name') or c.get('File Name') == '':
            id_ = c.get('ID') or c.get('Id') or c.get('id')
            if id_ and id_ in images_map:
                c['File Name'] = images_map[id_]
                count_filled += 1

    print(f'Filled File Name for {count_filled} cards from images.csv')

    out_dir = Path('docs')
    out_dir.mkdir(parents=True, exist_ok=True)

    cards_out = out_dir / 'cards.json'
    sets_out = out_dir / 'sets.json'
    images_out = out_dir / 'images.json'

    with cards_out.open('w', encoding='utf-8') as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)
    print('Wrote', cards_out)

    with sets_out.open('w', encoding='utf-8') as f:
        json.dump(sets, f, ensure_ascii=False, indent=2)
    print('Wrote', sets_out)

    if images:
        with images_out.open('w', encoding='utf-8') as f:
            json.dump(images, f, ensure_ascii=False, indent=2)
        print('Wrote', images_out)

    print('Conversion complete')

if __name__ == '__main__':
    main()
