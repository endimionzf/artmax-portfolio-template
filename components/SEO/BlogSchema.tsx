import { BlogPost } from '@/utils/blog';

export default function BlogSchema({ post }: { post: BlogPost }) {
  const siteUrl = 'https://artmaxstudio.ro';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title.rendered,
    description: post.seoDescription || post.excerpt.rendered.replace(/<[^>]*>?/gm, ''),
    keywords: post.seoKeywords,
    image: post.featured_media_url ? `${siteUrl}${post.featured_media_url}` : `${siteUrl}/favicon.ico`,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      '@type': 'Person',
      name: 'Maxim',
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Artmax Studio',
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/favicon.ico`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/blog/${post.slug}`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
