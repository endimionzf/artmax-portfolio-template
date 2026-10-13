# Artmax Studio — Modular Tech & Creative Portfolio Template

A high-performance, immersive 3D spatial portfolio and markdown journal template built with **Next.js 16 (Static Export)**, **Three.js (React Three Fiber)**, and **Tailwind CSS**.

Designed for zero-maintenance hosting: runs purely client-side with zero server runtime dependencies. Deployable to any web server, cPanel shared hosting (Hostico), GitHub Pages, Vercel, Netlify, or AWS S3 / Cloudflare Pages.

---

## 🚀 Key Features

- **Pure Static Site Generation (SSG)**: Zero Node.js runtime required in production (`output: 'export'`).
- **Interactive 3D WebGL Galaxy**: Free-flight camera with inertia damping, spatial media distribution, and customizable 3D ribbon curves.
- **Universal Media Viewer**: Auto-detects and displays both high-res photos/screenshots and videos (with spatial audio and YouTube support).
- **Adaptive Info Drawer**: Shows tech stack monospace neon pills, roles, clients, years, and context-aware smart links (`/blog` internal case studies, GitHub, live demos).
- **Single Source of Truth (`site.config.json`)**: Configure base paths (`/` or `/template`), site title, category labels, neon glow colors, and 3D curve presets without touching code.
- **Flat Media Architecture**: Store all assets flat in `public/portfolio/media/` driven by `public/portfolio/metadata.csv`.
- **Local Visual Project Editor (`npm run edit`)**: Lightweight, zero-dependency browser dashboard on `localhost:3333` for editing project details and discovering uncataloged media with 1-click sync.
- **Automated CI/CD**: Pre-configured GitHub Actions workflows for cPanel FTPS and GitHub Pages deployments.

---

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router in pure Static Export mode)
- **UI Library**: React 19 with React Compiler
- **3D Engine**: Three.js 0.183 with `@react-three/fiber` and `@react-three/drei`
- **Postprocessing**: `@react-three/postprocessing`
- **State Management**: Zustand
- **Styling**: Tailwind CSS 4

---

## 🚦 Getting Started

### 1. Installation

```bash
npm install
```

### 2. Configuration (`site.config.json`)

Customize deployment paths, site meta, and categories in `site.config.json`:

```json
{
  "$schema": "./site.config.schema.json",
  "deployment": {
    "basePath": ""
  },
  "site": {
    "title": "Your Name / Studio",
    "description": "Tech & Creative Spatial Portfolio"
  },
  "categories": [
    {
      "id": "code",
      "label": "Code",
      "color": "#00f3ff",
      "curvePreset": "ai",
      "description": "Software & Web Development"
    },
    {
      "id": "design",
      "label": "Design",
      "color": "#ff003c",
      "curvePreset": "video",
      "description": "UI/UX & Branding"
    },
    {
      "id": "3d",
      "label": "3D",
      "color": "#00ff41",
      "curvePreset": "render3d",
      "description": "3D Art & Motion"
    }
  ]
}
```

*Curve presets available:*
- `"video"`: Smooth CatmullRom spline with animated playhead waveform.
- `"render3d"`: Architectural wireframe spline with interactive tuning nodes.
- `"ai"`: Cyberpunk Manhattan circuit with digital pulses.

### 3. Local Visual Project Editor

Run the local visual editor to add or update projects in `metadata.csv` without spreadsheets:

```bash
npm run edit
```
Open [http://localhost:3333](http://localhost:3333). You can:
- View thumbnails of all cataloged projects.
- Detect newly added media in `public/portfolio/media/` and add them with 1 click.
- Edit Titles, Categories, Tech Stack, Roles, and Smart Links.
- Click **"Sync & Save"** to update `metadata.csv` and auto-generate `portfolio.json`.

### 4. Local Development Server

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) (or `http://localhost:3000/template` if `basePath` is configured).

---

## 📦 Building & Testing Static Release

### Build Static Output

```bash
npm run build
```
This produces pure static HTML, CSS, JavaScript, and media in `out/`.

### Preview Static Build Locally

```bash
npm run preview
# Serves the out/ directory on port 3000
```

---

## 🚢 Automated Deployment (GitHub Actions)

Two pre-configured workflows are included in `.github/workflows/`:

### Option A: Hostico / cPanel (FTPS)
Workflow: `.github/workflows/deploy-cpanel-ftp.yml`

Automatically builds and syncs `out/` to your hosting server on git push.

**Required GitHub Repository Secrets** (Settings → Secrets and variables → Actions):
- `CPANEL_FTP_SERVER`: Your FTP host (e.g. `ftp.yourdomain.com`).
- `CPANEL_FTP_USERNAME`: Your cPanel FTP username.
- `CPANEL_FTP_PASSWORD`: Your FTP password.
- `CPANEL_FTP_REMOTE_DIR` *(optional)*: Remote target path (defaults to `public_html/`, or `public_html/template/` for subfolder deployments).

### Option B: GitHub Pages
Workflow: `.github/workflows/deploy-github-pages.yml`

Automatically builds and deploys to GitHub Pages with the repository name automatically set as `basePath`.

**Setup:**
1. In your GitHub repository: Settings → Pages.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Push to `main` branch or trigger manually under the **Actions** tab.
