import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const SITE_URL = 'https://artmaxstudio.ro';
const CONTENT_DIR = path.join(process.cwd(), 'content/blog');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

async function generateSitemap() {
  console.log('--- Generating Hardened Sitemap.xml ---');
  
  const files = fs.readdirSync(CONTENT_DIR);
  const posts = files
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const slug = file.replace('.md', '');
      const fullPath = path.join(CONTENT_DIR, file);
      const fileContents = fs.readFileSync(fullPath, 'utf8');
      const { data } = matter(fileContents);
      
      return {
        url: `${SITE_URL}/blog/${slug}/`,
        lastmod: data.date || new Date().toISOString().split('T')[0],
      };
    });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/blog/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  ${posts.map(post => `
  <url>
    <loc>${post.url}</loc>
    <lastmod>${post.lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('')}
</urlset>`;

  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemap);
  console.log('--- Sitemap.xml created in /public ---');
}

generateSitemap().catch(console.error);
