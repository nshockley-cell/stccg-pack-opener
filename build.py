import pandas as pd
import json
from pathlib import Path

EXCEL_FILE = "cards-2.xlsx"
SET_CODE = "AGT"

OUT_DIR = Path("site")
OUT_FILE = OUT_DIR / "cards.json"

print("Loading cards...")
df = pd.read_excel(EXCEL_FILE)

print("Filtering set:", SET_CODE)
df = df[df["Set Code"] == SET_CODE].copy()

# Convert NaN to empty strings so JSON is clean
df = df.fillna("")

cards = df.to_dict(orient="records")

OUT_DIR.mkdir(exist_ok=True)
with open(OUT_FILE, "w", encoding="utf-8") as f:
    json.dump(cards, f, ensure_ascii=False, indent=2)

print("Cards found:", len(cards))
print("Wrote:", OUT_FILE)