import { getPostBySlug, getPosts } from '@/utils/blog';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import BlogSchema from '@/components/SEO/BlogSchema';

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: 'Post Not Found' };

  return {
    title: `${post.title.rendered} | Artmax Studio`,
    description: post.seoDescription || post.excerpt.rendered.replace(/<[^>]*>?/gm, ''),
    keywords: post.seoKeywords,
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="h-screen overflow-y-auto bg-[#0a0a0a] text-[#ccc] selection:bg-[#ff003c] selection:text-white">
      <BlogSchema post={post} />
      
      {/* Immersive Background Glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#00f3ff]/5 rounded-full blur-[120px]" />
      </div>

      <nav className="fixed top-0 left-0 w-full bg-[#0a0a0a]/40 backdrop-blur-xl border-b border-white/5 z-10 px-6 py-5">
        <div className="max-w-4xl mx-auto flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.3em] text-white/40">
          <Link href="/blog" className="hover:text-white transition-all flex items-center group">
            <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span> Index
          </Link>
          <div className="text-white/20">
            Post_Analysis // {post.slug}
          </div>
          <Link href="/" className="hover:text-white transition-all">
            Exit
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24 relative">
        {/* Post Meta */}
        <div className="mb-12">
          <div className="flex items-center gap-3 font-mono text-[9px] text-[#ff003c] uppercase tracking-[0.3em] mb-4">
            <span className="w-2 h-px bg-[#ff003c]/40" />
            Publication Date // {new Date(post.date).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
          </div>
          <h1 className="text-3xl md:text-5xl font-normal leading-[1.1] text-white tracking-tighter">
            {post.title.rendered}
          </h1>
        </div>

        {/* Featured Image */}
        {post.featured_media_url && (
          <div className="relative aspect-[16/9] w-full mb-16 rounded-sm overflow-hidden border border-white/10 bg-white/5">
            <Image 
              src={post.featured_media_url} 
              alt={post.title.rendered}
              fill
              className="object-cover opacity-80"
              priority
            />
            {/* Subtle Gradient Fade */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/40 to-transparent" />
          </div>
        )}

        {/* Post Content */}
        <article 
          className="journey-log-content max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content.rendered }}
        />

        {/* Footer Navigation */}
        <footer className="mt-24 pt-12 border-t border-white/5 text-center md:text-right">
          <div className="inline-flex flex-col items-end gap-2">
            <div className="text-[10px] font-mono text-white/10 uppercase tracking-widest select-none">
              End_of_Transmission
            </div>
            <Link 
              href="/blog" 
              className="group text-xs font-mono uppercase tracking-widest text-white/40 hover:text-white transition-all"
            >
              Return to Journal <span className="ml-2 group-hover:translate-x-1 transition-transform inline-block">→</span>
            </Link>
          </div>
        </footer>
      </main>

      {/* Visual Overlay: Post-specific Scanlines */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:100%_4px] z-50" />
    </div>
  );
}
