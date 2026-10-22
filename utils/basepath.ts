/**
 * Prepends the deployment base path (e.g. '/artmax-portfolio-template') to relative URLs.
 * Essential for GitHub Pages subfolder hosting when Next.js unoptimized static images/assets are used.
 */
export function withBasePath(url?: string): string {
  if (!url) return '';
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (!basePath) return url;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//') || url.startsWith('data:')) {
    return url;
  }
  if (url.startsWith(basePath)) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${basePath}${cleanPath}`;
}
