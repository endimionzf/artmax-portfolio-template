import Link from 'next/link';

export const metadata = {
  title: '404 // Coordinate Not Found | Artmax Studio',
  description: 'The requested spatial coordinates do not exist in this portfolio galaxy.',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0] selection:bg-[#ff003c] selection:text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Immersive Background Glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-[#ff003c]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#00f3ff]/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-lg text-center flex flex-col items-center">
        <div className="font-mono text-xs text-[#00f3ff] tracking-[0.3em] uppercase mb-4 px-3 py-1 bg-[#00f3ff]/10 rounded-full border border-[#00f3ff]/20">
          404 // Signal_Lost
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
          Coordinate Not Found
        </h1>

        <p className="text-white/60 text-sm md:text-base leading-relaxed mb-8">
          The requested coordinate or document does not exist in this spatial cluster. It may have drifted or been decommissioned.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 text-xs font-mono tracking-[0.2em] uppercase bg-white/5 hover:bg-white/10 text-white rounded-full border border-white/10 hover:border-white/30 transition-all duration-300 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          Return to Galaxy
        </Link>
      </div>

      <div className="absolute bottom-6 font-mono text-[10px] text-white/20 tracking-widest uppercase">
        Artmax Studio // Spatial_Navigator
      </div>
    </div>
  );
}
