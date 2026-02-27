I have investigated the website https://artmaxstudio.ro/fetedeimprumut/ to determine why the videos are not loading correctly on mobile devices (iPhone and Android).

Key Findings & Issues
Server Issue: Lack of Byte Range Support (Critical for iPhone/iOS)

Finding: My tests revealed that your server does not correctly handle HTTP Range requests. When a range is requested, the server responds with a 200 OK (sending the whole file) instead of the required 206 Partial Content.
Impact: iOS Safari is very strict about this; if a server doesn't support range requests, the video often fails to load or play entirely. This is likely the primary reason why iPhones are not loading the videos.
Asset Weight: Large Preview File Sizes (Android Performance)

Finding: The "preview" videos for the tiles are extremely large for mobile. For example:
ciocolata-preview.mp4: 12.5 MB
asteptariclare-preview.mp4: 8.5 MB
Impact: The page attempts to load and play multiple previews concurrently. On mobile networks, downloading several 5-10MB files at once causes the "long wait" observed on Android.
Video Formats & Fallbacks

Finding: The videos use the VP9 codec within an .mp4 container. While modern iPhones (iOS 14.1+) support VP9 in MP4, it often requires specific hardware acceleration. The HTML current structure uses a single src attribute for the <video> tag:
html
<video autoplay muted playsinline loop src=".../ciocolata-preview.mp4"></video>
Impact: There is no H.264 (AVC) fallback provided. H.264 is the most universally supported format and should be included as a fallback for older devices or browsers that struggle with VP9 in MP4.
Missing Assets

Finding: The console reported a 404 error for audio/ambient.mp4. This missing file might be intended for background media which is currently failing to load.
Recommendations
Enable Byte Range Support: Configure your server (e.g., Nginx, Apache) or CDN to support byte-range requests. This will allow iOS Safari to "seek" and buffer the video properly, which is required for playback.
Optimize Previews: Compress the preview videos significantly. A preview should ideally be:
Lower resolution (e.g., 480p or even lower).
Lower bitrate.
Target size: < 1 MB per preview.
Provide Fallbacks: Use the <source> tag structure to provide multiple formats:
html
<video autoplay muted playsinline loop>

  <source src="video.mp4" type="video/mp4; codecs=vp9">
  <source src="video-fallback.mp4" type="video/mp4; codecs=avc1.42E01E">
</video>
Implement Lazy Loading: Instead of loading all preview videos at once, only load the video when the tile enters the viewport or when the user interacts with it. This will drastically improve the initial load time and performance on Android.
