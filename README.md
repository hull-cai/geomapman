# Manchester Geological Map (Leaflet + BGS WMS)

Interactive geological map focused on Manchester using:
- **Leaflet** for web mapping
- **OpenStreetMap** for the basemap
- **British Geological Survey (BGS) Detailed Geology WMS** overlays

## Project structure

```text
geomapman/
├── index.html
├── styles.css
├── script.js
└── README.md
```

## Run locally

Because this is a static project, you can serve it with any local web server.

### Option A: Python

```bash
python3 -m http.server 8080
```

Open: `http://localhost:8080`

### Option B: VS Code Live Server

Open the folder and run **Live Server** on `index.html`.

## Features

- Manchester map centered at **53.4808, -2.2426** with zoom level **12**.
- Layer control with toggleable geology themes from BGS WMS:
  - Bedrock geology
  - Superficial deposits
  - Artificial ground
  - Linear features
- Click-to-query map using WMS **GetFeatureInfo**.
- Popup displays useful attributes where available (e.g., unit, rock, age, description).
- Graceful warnings when geology tiles or feature queries fail.
- Responsive layout for desktop and mobile.

## Notes on BGS data

The app uses this WMS service endpoint:

`https://map.bgs.ac.uk/arcgis/services/BGS_Detailed_Geology/MapServer/WMSServer?`

Layer names can occasionally change when data services are updated by the provider. If you stop seeing geology overlays, check current layer IDs in WMS GetCapabilities and update `geologyDefinitions` in `script.js`.

## Deploy as a static site

### GitHub Pages

1. Push this repository to GitHub.
2. In **Settings → Pages**, set source to:
   - Branch: `main` (or your default branch)
   - Folder: `/ (root)`
3. Save. GitHub will provide a live URL, typically:
   - `https://<username>.github.io/<repository>/`

### Netlify / Cloudflare Pages

- Create a new site from the Git repo.
- Build command: *(none)*
- Publish directory: `.` (repo root)

No bundler is required.
