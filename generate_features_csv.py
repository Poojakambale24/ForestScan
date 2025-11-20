import os
import cv2
import numpy as np
import pandas as pd
from skimage.feature import graycomatrix, graycoprops

# ======================= CONFIG ===========================
dataset_path = r'D:\Capstone Phase II\DataSet_Phase_II'  # Input image directory
output_csv = 'features.csv'               # Output CSV path
resize_dim = (256, 256)                   # Standard resize dimension
glcm_distances = [1]                      # Distances for GLCM
glcm_angles = [0]                         # Angles for GLCM (0°, horizontal)
glcm_levels = 256                         # Intensity levels for GLCM
# ==========================================================

data_rows = []

for district in os.listdir(dataset_path):
    district_path = os.path.join(dataset_path, district)
    if not os.path.isdir(district_path):
        continue

    for taluka in os.listdir(district_path):
        taluka_path = os.path.join(district_path, taluka)
        if not os.path.isdir(taluka_path):
            continue

        for filename in os.listdir(taluka_path):
            if filename.endswith(('.jpg', '.png', '.jpeg')):
                try:
                    # Extract year from filename
                    try:
                        year = int(filename.split('_')[-1].split('.')[0])
                    except:
                        raise ValueError("Invalid filename format for year")

                    # Load and validate image
                    img_path = os.path.join(taluka_path, filename)
                    img = cv2.imread(img_path)
                    if img is None:
                        raise ValueError("Image could not be read")

                    # Resize image
                    img = cv2.resize(img, resize_dim)

                    # Split RGB channels
                    b, g, r = cv2.split(img)

                    # Convert channels to float32
                    g = g.astype(np.float32)
                    r = r.astype(np.float32)

                    # Compute NDVI: (G - R) / (G + R)
                    ndvi = (g - r) / (g + r + 1e-5)

                    # Clip NDVI to range [-1, 1]
                    ndvi = np.clip(ndvi, -1, 1)

                    # Replace NaNs (if any)
                    ndvi = np.nan_to_num(ndvi)

                    # Take mean NDVI
                    mean_ndvi = np.mean(ndvi)

                    # Green/Red intensity ratio
                    green_red_ratio = np.mean(g) / (np.mean(r) + 1e-5)

                    # Convert to grayscale for GLCM
                    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

                    # Compute GLCM matrix
                    glcm = graycomatrix(gray,
                                        distances=glcm_distances,
                                        angles=glcm_angles,
                                        levels=glcm_levels,
                                        symmetric=True,
                                        normed=True)

                    # Extract GLCM features
                    contrast = graycoprops(glcm, 'contrast')[0, 0]
                    homogeneity = graycoprops(glcm, 'homogeneity')[0, 0]
                    energy = graycoprops(glcm, 'energy')[0, 0]

                    # Append to result
                    data_rows.append({
                        'District': district,
                        'Taluka': taluka,
                        'Year': year,
                        'NDVI': round(mean_ndvi, 4),
                        'Red': round(np.mean(r), 2),
                        'Green': round(np.mean(g), 2),
                        'Blue': round(np.mean(b), 2),
                        'GLCM_Contrast': round(contrast, 4),
                        'GLCM_Homogeneity': round(homogeneity, 4),
                        'GLCM_Energy': round(energy, 4),
                        'Green/Red_Ratio': round(green_red_ratio, 4)
                    })

                    print(f"[✔] Processed: {filename}")

                except Exception as e:
                    print(f"[❌] Error processing {filename}: {e}")

# Save features to CSV
if data_rows:
    df = pd.DataFrame(data_rows)
    df.to_csv(output_csv, index=False)
    print(f"\n✅ Feature extraction complete. CSV saved at: {output_csv}")
else:
    print("\n⚠️ No valid images were processed.")
