from flask import Flask, render_template, request, jsonify, send_from_directory
import pandas as pd
import numpy as np
import json
from statistics import median
import os

app = Flask(__name__, static_folder='static', template_folder='templates')

import pathlib

# Path to CSV
DATA_PATH = os.path.join(os.path.dirname(__file__), 'merged_output.csv')


def load_and_prepare():
    df = pd.read_csv(DATA_PATH)
    # Clean column names
    df.columns = [c.strip() for c in df.columns]
    # Ensure numeric types
    df['Year'] = pd.to_numeric(df['Year'], errors='coerce')
    df['NDVI'] = pd.to_numeric(df['NDVI'], errors='coerce')
    for col in ['GLCM_Contrast', 'GLCM_Homogeneity', 'GLCM_Energy']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # Load optional centroids file if present
    centroids = {}
    centroids_path = os.path.join(os.path.dirname(__file__), 'taluka_centroids.csv')
    if os.path.exists(centroids_path):
        try:
            cdf = pd.read_csv(centroids_path)
            for _, r in cdf.iterrows():
                d = str(r.get('District','')).strip()
                t = str(r.get('Taluka','')).strip()
                lat = float(r.get('lat', r.get('latitude', r.get('Lat', None)) or 0))
                lon = float(r.get('lon', r.get('longitude', r.get('Lon', None)) or 0))
                if d and t:
                    centroids.setdefault(d, {})[t] = (lat, lon)
        except Exception:
            centroids = {}

    # Group by District & Taluka
    grouped = {}
    for (district, taluka), g in df.groupby(['District', 'Taluka']):
        g_sorted = g.sort_values('Year')
        years = g_sorted['Year'].astype(int).tolist()
        ndvi = g_sorted['NDVI'].fillna(0).tolist()

        # compute robust slope (Theil-Sen median of pairwise slopes) if enough points
        def theil_sen_slope(x, y):
            # remove NaNs and ensure matching lengths
            pts = [(float(xi), float(yi)) for xi, yi in zip(x, y) if xi is not None and yi is not None]
            if len(pts) < 2:
                return 0.0
            slopes = []
            n = len(pts)
            for i in range(n-1):
                xi, yi = pts[i]
                for j in range(i+1, n):
                    xj, yj = pts[j]
                    if xj != xi:
                        slopes.append((yj - yi) / (xj - xi))
            if not slopes:
                return 0.0
            return float(median(slopes))

        slope = theil_sen_slope(years, ndvi)

        # Determine zone by slope according to rules
        if slope < -0.02:
            zone = 'Red Zone'
        elif slope < 0.01:
            zone = 'Orange Zone'
        else:
            zone = 'Green Zone'

        # Extract GLCM series
        glcm = {}
        for col, key in [('GLCM_Contrast', 'contrast'), ('GLCM_Homogeneity', 'homogeneity'), ('GLCM_Energy', 'energy')]:
            if col in g_sorted.columns:
                glcm[key] = g_sorted[col].fillna(0).tolist()
            else:
                glcm[key] = [0] * len(years)

        # Green/Red ratio
        ratio = g_sorted.get('Green/Red_Ratio', g_sorted.get('Green/Red Ratio', pd.Series([None]*len(years)))).tolist()

        # Cluster labels
        cluster = g_sorted.get('Cluster', pd.Series([None]*len(years))).tolist()

        grouped.setdefault(district, {})[taluka] = {
            'district': district,
            'taluka': taluka,
            'years': years,
            'ndvi_values': ndvi,
            'glcm': glcm,
            'green_red_ratio': ratio,
            'cluster': cluster,
            'slope': float(slope),
            'zone': zone
        }

    return grouped


def load_centroids_file():
    centroids = {}
    centroids_path = os.path.join(os.path.dirname(__file__), 'taluka_centroids.csv')
    if os.path.exists(centroids_path):
        try:
            cdf = pd.read_csv(centroids_path)
            for _, r in cdf.iterrows():
                d = str(r.get('District','')).strip()
                t = str(r.get('Taluka','')).strip()
                lat = r.get('lat', r.get('latitude', r.get('Lat', None)))
                lon = r.get('lon', r.get('longitude', r.get('Lon', None)))
                try:
                    lat = float(lat)
                    lon = float(lon)
                except Exception:
                    continue
                if d and t:
                    centroids.setdefault(d, {})[t] = (lat, lon)
        except Exception:
            centroids = {}
    return centroids


CENTROIDS = load_centroids_file()

BOUNDS = None
bounds_path = os.path.join(os.path.dirname(__file__), 'taluka_bounds.geojson')
if os.path.exists(bounds_path):
    try:
        with open(bounds_path, 'r', encoding='utf-8') as fh:
            BOUNDS = json.load(fh)
    except Exception:
        BOUNDS = None

DATA = load_and_prepare()


def taluka_to_coord(district, taluka):
    # If CENTROIDS provided, use real lat/lon
    try:
        if CENTROIDS and district in CENTROIDS and taluka in CENTROIDS[district]:
            return CENTROIDS[district][taluka]
    except Exception:
        pass

    # No real coordinates — create deterministic pseudo-coordinates for visualization.
    s = (district + '|' + taluka).encode('utf-8')
    h = sum(b for b in s)
    # India approx lat: 8 to 37, lon: 68 to 97
    lat = 8 + (h % 290) * (29.0 / 289.0)  # maps 0..289 -> ~8..37
    lon = 68 + (h % 290) * (29.0 / 289.0)  # maps 0..289 -> ~68..97
    return float(lat), float(lon)


@app.route('/bounds')
def bounds():
    # Return GeoJSON feature(s) for requested taluka (if BOUNDS geojson was provided)
    if BOUNDS is None:
        return jsonify({'error': 'No bounds geojson available'}), 404

    taluka = request.args.get('taluka', '')
    district = request.args.get('district', '')
    if '|' in taluka:
        parts = [p.strip() for p in taluka.split('|')]
        if len(parts) == 2:
            district, taluka = parts

    taluka = taluka.strip()
    district = district.strip()

    matches = []
    features = BOUNDS.get('features', [])
    for feat in features:
        props = feat.get('properties', {})
        # check several common property names
        p_d = str(props.get('District', props.get('district', props.get('DISTRICT', '')))).strip()
        p_t = str(props.get('Taluka', props.get('taluka', props.get('NAME_2', props.get('NAME_1', ''))))).strip()
        if taluka and p_t and taluka.lower() in p_t.lower():
            matches.append(feat)
        elif district and p_d and district.lower() in p_d.lower():
            matches.append(feat)

    if not matches:
        return jsonify({'error': 'No matching boundary found'}), 404

    # return FeatureCollection of matches
    return jsonify({ 'type': 'FeatureCollection', 'features': matches })


@app.route('/upload_geo', methods=['POST'])
def upload_geo():
    # Accept a GeoJSON file upload (dev utility) and save as static/geo/india.geojson
    if 'geo' not in request.files:
        return jsonify({'error': 'no file part'}), 400
    f = request.files['geo']
    if f.filename == '':
        return jsonify({'error': 'no selected file'}), 400
    # ensure directory exists
    geo_dir = os.path.join(os.path.dirname(__file__), 'static', 'geo')
    pathlib.Path(geo_dir).mkdir(parents=True, exist_ok=True)
    dest = os.path.join(geo_dir, 'india.geojson')
    try:
        f.save(dest)
        return jsonify({'ok': True, 'path': '/static/geo/india.geojson'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')


@app.route('/about')
def about():
    return render_template('about.html')


@app.route('/suggest')
def suggest():
    q = request.args.get('q', '').lower()
    results = []
    for district, talukas in DATA.items():
        for t in talukas.keys():
            label = f"{district} | {t}"
            if q in t.lower() or q in district.lower() or q in label.lower():
                results.append({'district': district, 'taluka': t, 'label': label})
    # return top 20
    return jsonify(results[:20])


@app.route('/search')
def search():
    taluka = request.args.get('taluka', '')
    district = request.args.get('district', '')

    # allow passing 'district | taluka' in taluka param
    if '|' in taluka:
        parts = [p.strip() for p in taluka.split('|')]
        if len(parts) == 2:
            district, taluka = parts

    # find entry
    entry = None
    if district and taluka:
        entry = DATA.get(district, {}).get(taluka)
    else:
        # search taluka across all districts
        for d, talukas in DATA.items():
            if taluka in talukas:
                entry = talukas[taluka]
                district = d
                break

    if not entry:
        return jsonify({'error': 'Taluka not found', 'taluka': taluka}), 404

    lat, lon = taluka_to_coord(district, taluka)

    response = {
        'district': entry['district'],
        'taluka': entry['taluka'],
        'years': entry['years'],
        'ndvi_values': entry['ndvi_values'],
        'glcm': entry['glcm'],
        'zone': entry['zone'],
        'slope': entry['slope'],
        'cluster': entry['cluster'],
        'lat': lat,
        'lon': lon
    }

    return jsonify(response)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
