import React, { useEffect, useRef, useState } from 'react';
import type { Language } from '../types';

export type TheaterItem =
  | { kind: 'vod'; uuid: string; title: string; kickUrl: string; poster?: string; subOnly?: boolean; meta?: string }
  | { kind: 'clip'; title: string; hls: string; kickUrl: string; poster?: string; meta?: string };

interface VodTheaterProps {
  lang: Language;
  item: TheaterItem | null;
  onClose: () => void;
}

/* Native HLS playback (hls.js, lazy-loaded so the main bundle stays lean) */
const NativePlayer: React.FC<{ src?: string; vodUuid?: string; poster?: string; onBlocked?: () => void }> = ({ src, vodUuid, poster, onBlocked }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(src ? 'ready' : 'loading');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let hls: any = null;
    let dead = false;
    (async () => {
      try {
        // Resolve the real Kick video file (main VOD source) when only a uuid is given:
        // dedicated resolver first, generic proxy as fallback
        let url = src || '';
        if (!url && vodUuid) {
          try {
            const r = await fetch('/api/vod?uuid=' + encodeURIComponent(vodUuid));
            const j = await r.json();
            if (j?.source) url = j.source;
          } catch {}
          if (!url) {
            const r = await fetch('/api/kick?endpoint=' + encodeURIComponent(`https://kick.com/api/v1/video/${vodUuid}`));
            if (!r.ok) throw new Error('blocked');
            const j = await r.json();
            url = j?.source || '';
          }
          if (!url) throw new Error('blocked');
        }
        if (dead || !url) return;
        if (el.canPlayType('application/vnd.apple.mpegurl')) {
          el.src = url;
        } else {
          const mod: any = await import('hls.js');
          const Hls = mod?.default || mod;
          if (dead) return;
          if (Hls?.isSupported?.()) {
            hls = new Hls({ maxBufferLength: 30 });
            hls.loadSource(url);
            hls.attachMedia(el);
          } else {
            el.src = url;
          }
        }
        setState('ready');
        el.play().catch(() => {});
      } catch {
        if (!dead) { setState('error'); onBlocked?.(); }
      }
    })();
    return () => { dead = true; try { hls?.destroy?.(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, vodUuid]);
  if (state === 'error') return null;
  return (
    <div className="relative w-full h-full bg-black">
      {state === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
          {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25 blur-sm" />}
          <svg className="relative w-10 h-10 animate-spin text-[#E10600]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        </div>
      )}
      <video ref={ref} className="relative w-full h-full" controls playsInline preload="metadata" poster={poster} />
    </div>
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
    <VodBody key={item.kind === 'vod' ? item.uuid : item.hls} lang={lang} item={item} subOnly={!!subOnly} onClose={onClose} />
  );
};

const VodBody: React.FC<{ lang: Language; item: TheaterItem; subOnly: boolean; onClose: () => void }> = ({ lang, item, subOnly, onClose }) => {
  const isAr = lang === 'ar';
  const [blocked, setBlocked] = useState(false);

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
              {blocked ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center p-6">
                  <span className="w-14 h-14 rounded-2xl bg-[#E10600]/10 border border-[#E10600]/40 flex items-center justify-center">
                    <svg className="w-7 h-7 text-[#FF8A8A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </span>
                  <p className="text-white font-black text-sm md:text-base">{isAr ? 'هذا التسجيل للمشتركين فقط' : 'Subscribers only'}</p>
                  <p className="text-white/45 text-[12px] font-medium">{isAr ? 'اشترك في قناة كيك عشان تشوفه كامل' : 'Subscribe on Kick to watch the full VOD'}</p>
                  <a href={item.kickUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E10600] text-white text-[13px] font-black hover:brightness-110 transition-all">
                    {isAr ? 'اشترك وشاهد في كيك' : 'Sub & watch on Kick'}
                  </a>
                </div>
              ) : item.kind === 'clip' ? (
                <NativePlayer src={item.hls} poster={item.poster} onBlocked={() => setBlocked(true)} />
              ) : (
                <NativePlayer vodUuid={item.uuid} poster={item.poster} onBlocked={() => setBlocked(true)} />
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
