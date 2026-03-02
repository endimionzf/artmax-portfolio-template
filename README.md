# Artmax Immersive Portfolio

A high-performance, immersive 3D video portfolio built with **Next.js**, **Three.js (React Three Fiber)**, and **Postprocessing**.

## 🚀 Key Features

- **Spatial Video Network**: An organic, 3D-distributed network of video planes with visibility culling and optimized raycasting.
- **Cinematic Mobile Experience**: Dedicated `MobileVideoOverlay` with a muffled "underwater" audio effect using the Web Audio API (BiquadFilter).
- **Production-Grade Streaming**: Custom video proxy at `/api/portfolio/video/` supporting HTTP range requests for seamless playback on Safari and iOS.
- **Optimized Video Pipeline**: Automated scripts for thumbnail generation and iPhone-compliant video encoding (AAC-LC, Baseline 3.1).
- **Adaptive HUD**: A reactive, auto-hiding interface for a clean, immersive viewing experience.

## 🛠 Tech Stack

- **Framework**: Next.js 15+
- **3D Engine**: React Three Fiber (@react-three/fiber)
- **Utilities**: Three-stdlib, Drei, Maath
- **Styling**: Tailwind CSS 4
- **Audio**: Web Audio API

## 📦 Project Structure

- `/components/SpatialMedia`: Core 3D media components (MediaPlane, etc.).
- `/components/MobileVideoOverlay`: Specialized mobile playback UI.
- `/app/api/portfolio`: Dynamic portfolio scanners and video streaming proxy.
- `/scripts`: Python and Node.js utilities for media processing and optimization.

## 🚦 Getting Started

### Prerequisites

- Node.js >= 20.9.0
- FFmpeg (required for video optimization scripts)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Video Optimization

Before deploying, run the optimization suite:

```bash
# General optimization
npm run optimize

# iPhone/Safari compatibility fix
node scripts/fix-mobile-videos.mjs
```

### Deployment

Build and bundle the application for production:

```bash
# Full bundle
npm run bundle:win

# Fast bundle (no media)
./bundle-no-media.ps1
```
