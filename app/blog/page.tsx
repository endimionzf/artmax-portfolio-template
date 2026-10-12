import { getPosts } from '@/utils/blog';
import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Journey Log | Artmax Studio',
  description: 'Chronicles of immersive exploration and digital craftsmanship.',
};

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className="h-screen overflow-y-auto bg-[#0a0a0a] text-[#f0f0f0] selection:bg-[#ff003c] selection:text-white overflow-x-hidden">
      {/* Immersive Background Glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ff003c]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#00f3ff]/5 rounded-full blur-[120px]" />
      </div>

      <nav className="fixed top-0 left-0 w-full bg-[#0a0a0a]/40 backdrop-blur-xl border-b border-white/5 z-10 px-6 py-5">
        <div className="max-w-6xl mx-auto flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.3em] text-white/40">
          <Link href="/" className="hover:text-white transition-all flex items-center group">
            <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span> Return_Home
          </Link>
          <div className="text-white/20">
            Journal // Insights_&_Case_Studies
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 pt-32 pb-24 relative">
        <header className="mb-20">
          <h1 className="text-4xl md:text-6xl font-normal leading-tight tracking-tighter text-white mb-6">
            The Journal
          </h1>
          <p className="text-[#888] max-w-xl text-lg font-light leading-relaxed">
            Technical deep-dives into modern post-production, AI integration, and the forensic logic behind cinematic workflows.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {posts.map((post) => (
            <article key={post.id} className="group relative">
              <Link href={`/blog/${post.slug}`} className="block">
                <div className="relative aspect-[16/9] w-full mb-6 rounded-sm overflow-hidden border border-white/5 bg-white/5 transition-all group-hover:border-white/20">
                  {post.featured_media_url ? (
                    <Image 
                      src={post.featured_media_url} 
                      alt={post.title.rendered}
                      fill
                      className="object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest text-white/10 italic"> [Visual_Feed_Offline] </div>
                  )}
                  {/* Subtle Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent opacity-60" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-[9px] font-mono text-white/30 uppercase tracking-[0.2em]">
                    <span>{new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    <span className="w-1 h-1 rounded-full bg-[#ff003c]" />
                    <span className="text-[#00f3ff]">Log_Entry</span>
                  </div>

                  <h2 className="text-2xl font-normal text-white group-hover:text-[#00f3ff] transition-colors leading-snug">
                    {post.title.rendered}
                  </h2>

                  <div 
                    className="text-[#666] line-clamp-2 text-sm font-light leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: post.excerpt.rendered }}
                  />

                  <div className="pt-4">
                    <span className="inline-flex items-center text-[10px] font-mono uppercase tracking-widest text-white hover:text-[#00f3ff] transition-all">
                      Read Log <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                    </span>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </main>

      {/* Visual Overlay: Ultra-faint scanlines (No Grain) */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.01] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:100%_4px] z-50" />
    </div>
  );
}
