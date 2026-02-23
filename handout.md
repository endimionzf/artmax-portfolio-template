# Project Handout: Immersive Portfolio Experience

## 🌟 Overview

An immersive, spatial 3D portfolio website built with **Next.js 16**, **React Three Fiber**, and **Three.js**. The experience features an infinite spatial gallery where media planes are distributed in 3D space, responding to scroll-based navigation and interactive focus states.

## 🚀 Key Features

- **Spatial Gallery**: Smooth, scroll-driven camera navigation through a 3D field of media planes.
- **Adaptive Layouts**:
  - **Explorer Mode**: A vertical/depth-based journey through project clusters.
  - **Grid Mode**: A structured, 2D grid layout for easy browsing.
- **Mobile-First Optimization**:
  - Dynamic XY spread that adapts to viewport aspect ratio.
  - Restricted video playback in Explorer/Grid modes on mobile to save bandwidth.
  - High-quality video source swapping in **Focus Mode**.
- **Spatial Audio**: Real-time 3D audio panner that reacts to camera proximity and focus states.
- **Intro Fly-In**: A premium landing animation that transitions the user from an overhead view into the spatial field.

## 🛠 Technical Architecture

- **Framework**: Next.js 16 with Turbopack (configured for Webpack compatibility).
- **3D Engine**: `@react-three/fiber` and `@react-three/drei`.
- **Media Management**:
  - **Video Pool**: A custom pooling system that limits active video elements to 6 for maximum performance.
  - **Spatial Hook**: `useSpatialVideo` and `useSpatialAudio` for synchronized media lifecycles.
- **Performance**:
  - Distance-based culling (planes are mounted/unmounted based on camera depth).
  - Frustum culling and horizontal/vertical distribution optimizations.

## 📈 Recent Improvements

- **Intro Visibility**: Increased culling threshold to 250 units to support the 120-unit camera intro fly-in.
- **Audio Reliability**: Corrected `AudioContext` initialization for production builds.
- **Focus Mode Fix**: Added a background click-to-exit handler to prevent focus "lock".
- **Responsive Layout**: Implemented aspect-ratio aware positioning for mobile portrait screens.

## 🔧 Development

```bash
# Start development server
npm run dev

# Build for production
npm run build
```

## 🌑 Aesthetic Design

- Vibrant gradients and glassmorphism UI.
- Smooth LERP-based transitions for camera and plane animations.
- HUD with interactive indicators and project metadata.
