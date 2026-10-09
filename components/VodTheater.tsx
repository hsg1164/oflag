import React, { useEffect, useRef, useState } from 'react';
import type { Language } from '../types';

export type TheaterItem =
  | { kind: 'vod'; title: string; embedUrl: string; kickUrl: string; poster?: string; subOnly?: boolean; meta?: string }
  | { kind: 'clip'; title: string; hls: string; kickUrl: string; poster?: string; meta?: string };

interface VodTheaterProps {
  lang: Language;
  item: TheaterItem | null;
  onClose: () => void;
}

/* Native HLS playback for clips (hls.js, lazy-loaded so the main bundle stays lean) */
const ClipPlayer: React.FC<{ src: string; poster?: string }> = ({ src, poster }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    let hls: any = null;
    let dead = false;
    (async () => {
      try {
        if (el.canPlayType('application/vnd.apple.mpegurl')) {
          el.src = src;
        } else {
          const mod: any = await import('hls.js');
          const Hls = mod?.default || mod;
          if (dead) return;
          if (Hls?.isSupported?.()) {
            hls = new Hls({ maxBufferLength: 30 });
            hls.loadSource(src);
            hls.attachMedia(el);
          } else {
            el.src = src;
          }
        }
        el.play().catch(() => {});
      } catch {
        if (!dead) setErr(true);
      }
    })();
    return () => { dead = true; try { hls?.destroy?.(); } catch {} };
  }, [src]);
  if (err) return null;
  return (
    <video ref={ref} className="w-full h-full bg-black" controls playsInline preload="metadata" poster={poster} />
  );
};

export const VodTheater: React.FC<VodTheaterProps> = ({ lang, item, onClose }) => {
  const isAr = lang === 'ar';
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [item, onClose]);

  if (!item) return null;
  const subOnly = item.kind === 'vod' && item.subOnly;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 animate-fade-in"
      role="dialog" aria-modal="true" aria-label={item.title}>
      <div className="absolute inset-0 bg-black/88 backdrop-blur-md" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-4xl animate-fade-in-up">
        <div className="rounded-[24px] p-[1.5px] bg-gradient-to-b from-[#E10600]/70 via-white/10 to-transparent shadow-[0_30px_90px_rgba(225,6,0,0.25)]">
          <div className="rounded-[22.5px] bg-[#0d0606] overflow-hidden">
            {/* header */}
            <div className="flex items-center gap-2.5 px-4 md:px-5 py-3 border-b border-white/[0.07] bg-black/60">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[0.2em] text-[#FF4D5A]" dir="ltr">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] animate-pulse" />
                {item.kind === 'vod' ? 'VOD' : 'CLIP'}
              </span>
              {subOnly && (
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/40 text-amber-300">
                  {isAr ? 'للمشتركين' : 'SUB ONLY'}
                </span>
              )}
              <p className="min-w-0 flex-1 text-[13px] md:text-sm font-black text-white truncate" dir="auto">{item.title}</p>
              <a href={item.kickUrl} target="_blank" rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white/70 hover:text-white hover:border-[#E10600]/60 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                {isAr ? 'فتح في كيك' : 'Open on Kick'}
              </a>
              <button onClick={onClose} aria-label={isAr ? 'إغلاق' : 'Close'}
                className="shrink-0 w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 text-white/70 hover:text-white hover:border-[#E10600]/60 hover:bg-[#E10600]/15 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* player */}
            <div className="aspect-video bg-black">
              {item.kind === 'clip' ? (
                <ClipPlayer src={item.hls} poster={item.poster} />
              ) : (
                <iframe key={item.embedUrl} src={item.embedUrl} className="w-full h-full border-0"
                  allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={item.title} />
              )}
            </div>
            {/* footer */}
            <div className="flex items-center gap-2 px-4 md:px-5 py-3 border-t border-white/[0.07] bg-black/60">
              <span className="text-[11px] text-white/40 font-medium truncate" dir="auto">
                {subOnly
                  ? (isAr ? 'هذا التسجيل للمشتركين — اشترك في كيك للمشاهدة الكاملة' : 'This VOD is for subscribers — sub on Kick to watch fully')
                  : (item.meta || (isAr ? 'مشاهدة داخل الموقع' : 'Watching inside the site'))}
              </span>
              <span className="ms-auto shrink-0 text-[10px] font-black tracking-[0.25em] text-white/30" dir="ltr">OFLAG • THEATER</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VodTheater;
