import pandas as pd

print("Python is running")
print("Pandas loaded")

df = pd.read_excel("cards-2.xlsx")

print("Excel file opened successfully")
print(df.head())
