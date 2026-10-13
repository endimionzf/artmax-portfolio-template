# Static Site Deployment Guide

This project is configured for pure Static Site Generation (SSG) with zero Node.js server runtime dependencies in production.

All pages, media catalog metadata, WebGL bundles, and blog articles compile directly into standard static HTML, CSS, JavaScript, and media assets inside the `out/` directory.

---

## 1. Local Build & Packaging

Build and package the site using either npm or PowerShell:

### Full Release (Includes all media)
Packages all static pages, assets, and videos into `deploy-static.zip`:
```bash
npm run package
# OR using PowerShell
npm run export:win
```

### Lightweight Release (Excludes heavy portfolio videos)
If video files are already uploaded to your server's `public_html/portfolio/` folder, generate a lightweight zip (~5 MB) that contains only code, styles, blog articles, audio, and metadata:
```bash
npm run package:nomedia
# OR using PowerShell
.\export.ps1 -NoMedia
```

---

## 2. Server Deployment (Hostico / cPanel `public_html`)

Because the site is 100% static:
- **No Node.js Application setup** is required in cPanel.
- **No Phusion Passenger** processes are used.
- **No `server.js` or `node_modules`** are deployed.

### Steps:
1. Log into your **cPanel**.
2. Open **File Manager** and navigate to your web root (`public_html` or domain subdirectory).
3. If previously running a Node.js App, stop/remove the Node.js application in cPanel "Setup Node.js App" and remove old `node_modules` from `public_html`.
4. Upload `deploy-static.zip` (or `deploy-static-nomedia.zip`).
5. Extract the archive directly into `public_html`.
6. Verify file permissions:
   - Folders: `755`
   - Files: `644`
   - `.htaccess`: `644` (ensures byte-range streaming and caching headers are active)

---

## 3. Local Static Preview

To preview the exact static export locally before deploying:
```bash
npm run build
npm run preview
```
This starts a local static HTTP server serving the `out/` directory with full HTTP range-request support for video seeking.
