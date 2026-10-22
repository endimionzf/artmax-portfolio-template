'use client';

import siteConfig from '@/site.config.json';

interface ContactOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactOverlay({ isOpen, onClose }: ContactOverlayProps) {
  if (!isOpen) return null;

  const contact = (siteConfig as any).contact || {};
  const title = contact.title || "Let's collaborate on your next immersive vision.";
  const email = contact.email || 'maxim@artmaxstudio.ro';
  const phone = contact.phone;
  const buttonText = contact.buttonText || 'Return to Experience';

  return (
    <div 
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#0f0f0f] transition-all duration-700 animate-in fade-in"
    >
      <div className="max-w-xl w-full px-8 flex flex-col items-center text-center">
        <h2 className="text-3xl md:text-5xl font-black text-white tracking-[0.1em] uppercase mb-8 leading-tight">
          {title}
        </h2>
        
        <div className="flex flex-col gap-6 mb-16 font-mono text-sm md:text-base tracking-[0.2em] text-white/70">
          {email && (
            <a 
              href={`mailto:${email}`} 
              className="hover:text-white transition-colors border-b border-white/10 pb-1"
            >
              {email}
            </a>
          )}
          {phone && (
            <a 
              href={`tel:${phone}`} 
              className="hover:text-white transition-colors border-b border-white/10 pb-1"
            >
              {phone}
            </a>
          )}
        </div>

        <button 
          onClick={onClose}
          className="px-10 py-3 border border-white/30 text-white font-mono text-[11px] uppercase tracking-[0.3em] hover:bg-white hover:text-black hover:border-white transition-all duration-500"
        >
          {buttonText}
        </button>
      </div>

      {/* Decorative Corner Accents */}
      <div className="absolute top-8 left-8 w-4 h-4 border-t border-l border-white/20" />
      <div className="absolute top-8 right-8 w-4 h-4 border-t border-r border-white/20" />
      <div className="absolute bottom-8 left-8 w-4 h-4 border-b border-l border-white/20" />
      <div className="absolute bottom-8 right-8 w-4 h-4 border-b border-r border-white/20" />
    </div>
  );
}
