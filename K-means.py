import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA

# Step 1: Load dataset
file_path = r'D:\Capstone Phase II\Features.csv'  # Update path if needed
df = pd.read_csv(file_path)

# Step 2: Prepare features
features = df.drop(columns=["District", "Taluka", "Year"])
scaler = StandardScaler()
scaled_features = scaler.fit_transform(features)

# Step 3: Apply KMeans with K=3 (Zone-wise)
k = 3
kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
df['Cluster'] = kmeans.fit_predict(scaled_features)

# 💡 Step 3.1: Map clusters to zone names
cluster_zone_map = {
    0: 'Green Zone',
    1: 'Orange Zone',
    2: 'Red Zone'
}
df['Zone'] = df['Cluster'].map(cluster_zone_map)

# Step 4: Reduce dimensions using PCA for 2D visualization
pca = PCA(n_components=2)
pca_features = pca.fit_transform(scaled_features)
df['PCA1'] = pca_features[:, 0]
df['PCA2'] = pca_features[:, 1]

# Step 5: Visualize Clusters in 2D
plt.figure(figsize=(8, 6))
sns.scatterplot(data=df, x='PCA1', y='PCA2', hue='Cluster', palette='Set2')
plt.title('K-Means Clustering with K=3 (Zone-wise)')
plt.xlabel('PCA1')
plt.ylabel('PCA2')
plt.legend(title='Cluster (Zone)')
plt.grid(True)
plt.show()

# Step 6: Bar plot - count of points per cluster
plt.figure(figsize=(6, 4))
sns.countplot(x='Cluster', data=df, palette='Set2')
plt.title('Count of Points per Cluster (Zone)')
plt.xlabel('Cluster (Zone)')
plt.ylabel('Number of Points')
plt.grid(True)
plt.show()

# Step 7: Console Outputs
print("\n========== CLUSTER COUNTS ==========")
print(df['Cluster'].value_counts().sort_index())

print("\n========== CLUSTER FEATURE MEANS ==========")
cluster_means = df.groupby('Cluster')[features.columns].mean()
print(cluster_means)

# Step 8: Save Taluka-Zone classification to CSV
output_columns = ['District', 'Taluka', 'Year', 'Cluster']
output_df = df[output_columns]

output_file = r'D:\Capstone Phase II\Taluka_Zone_Classification.csv'  # Change path if needed
output_df.to_csv(output_file, index=False)

print(f"\n✅ Taluka-Zone classification saved to: {output_file}")
