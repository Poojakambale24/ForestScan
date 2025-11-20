import pandas as pd

# Load both CSV files
df1 = pd.read_csv("features.csv")
df2 = pd.read_csv("Taluka_Zone_Classification.csv")

# Merge on common columns
merged_df = pd.merge(df1, df2, on=["District", "Taluka", "Year"], how="inner")

# Save the merged file
merged_df.to_csv("merged_output.csv", index=False)

print("Merge complete! File saved as merged_output.csv")
