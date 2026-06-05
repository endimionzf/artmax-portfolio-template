import { getSortedPostsData, getPostData, PostData } from './markdown';

export interface BlogPost {
  id: string | number;
  date: string;
  slug: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  featured_media_url?: string;
  categories: number[];
  seoDescription?: string;
  seoKeywords?: string;
}

// Bridges the Local Markdown files to the existing UI components
export async function getPosts(): Promise<BlogPost[]> {
  const postsData = await getSortedPostsData();
  
    return postsData.map((post, index) => ({
    id: index,
    date: post.date,
    slug: post.slug,
    title: { rendered: post.title },
    content: { rendered: '' },
    excerpt: { rendered: post.excerpt || '' },
    featured_media_url: post.thumbnail,
    categories: [10]
  }));
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const post = await getPostData(slug);
    
    return {
      id: post.slug,
      date: post.date,
      slug: post.slug,
      title: { rendered: post.title },
      content: { rendered: post.contentHtml || '' },
      excerpt: { rendered: post.excerpt || '' },
      featured_media_url: post.thumbnail,
      categories: [10],
      seoDescription: post.seoDescription,
      seoKeywords: post.seoKeywords
    };
  } catch (error) {
    console.error(`Error fetching post by slug ${slug}:`, error);
    return null;
  }
}
