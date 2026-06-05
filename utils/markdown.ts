import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';

const postsDirectory = path.join(process.cwd(), 'content/blog');

export interface PostMetadata {
  title: string;
  date: string;
  thumbnail: string;
  category: string;
  excerpt: string;
  seoDescription?: string;
  seoKeywords?: string;
}

export interface PostData extends PostMetadata {
  slug: string;
  contentHtml: string;
}

export async function getSortedPostsData() {
  // Get file names under /content/blog
  const fileNames = await fs.readdir(postsDirectory);
  const allPostsData = await Promise.all(
    fileNames.filter(fileName => fileName.endsWith('.md')).map(async (fileName) => {
      // Remove ".md" from file name to get slug
      const slug = fileName.replace(/\.md$/, '');

      // Read markdown file as string
      const fullPath = path.join(postsDirectory, fileName);
      const fileContents = await fs.readFile(fullPath, 'utf8');

      // Use gray-matter to parse the post metadata section
      const matterResult = matter(fileContents);

      // Combine the data with the slug
      return {
        slug,
        ...(matterResult.data as PostMetadata),
      };
    })
  );

  // Sort posts by date
  return allPostsData.sort((a, b) => {
    if (a.date < b.date) {
      return 1;
    } else {
      return -1;
    }
  });
}

export async function getPostData(slug: string): Promise<PostData> {
  const fullPath = path.join(postsDirectory, `${slug}.md`);
  const fileContents = await fs.readFile(fullPath, 'utf8');

  // Use gray-matter to parse the post metadata section
  const { data, content } = matter(fileContents);

  // Split content into Main Body and SEO Metadata
  // We split at the specific "LLM SEO & Metadata" heading
  const parts = content.split(/### LLM SEO & Metadata/i);
  const mainContent = parts[0];
  const seoSection = parts[1] || '';

  // Use remark to convert markdown into HTML string
  const processedContent = await remark()
    .use(html, { sanitize: false })
    .process(mainContent);
  const contentHtml = processedContent.toString();

  // Extract SEO keywords and description if available in the second part
  let seoKeywords = '';
  let seoDescription = '';

  if (seoSection) {
    const keywordMatch = seoSection.match(/\*\*Keywords:\*\*\s*(.*)/i);
    const problemMatch = seoSection.match(/\*\*Problem:\*\*\s*(.*)/i);
    
    if (keywordMatch) seoKeywords = keywordMatch[1].trim();
    if (problemMatch) seoDescription = problemMatch[1].trim();
  }

  // Combine the data with the slug and contentHtml
  return {
    slug,
    contentHtml,
    ...(data as PostMetadata),
    seoKeywords,
    seoDescription
  };
}
