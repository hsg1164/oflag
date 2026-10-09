import React, { useEffect, useState } from 'react';
import { XIcon } from './Icons';
import type { Language } from '../types';

interface StaffSectionProps {
  lang: Language;
}

interface Mod {
  handle: string;
  head?: boolean;
}

interface ModLive {
  handle: string;
  name: string;
  bio: string;
  followers: number;
  avatar: string;
  verified: boolean;
  head: boolean;
}

const MODS: Mod[] = [
  { handle: 'itsxAREEJ1', head: true },
  { handle: 's7_moataz' },
  { handle: 'iriliir_5' },
  { handle: 'i_fares_0i' },
  { handle: 'sa3bood911' },
  { handle: 'vghalaa1' },
  { handle: 'iey52' },
  { handle: '_aishilad' },
  { handle: '_a7medo_' },
  { handle: 's7le_a' },
  { handle: '2nellyy' },
];

const fmtNum = (n: number) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;

const SkeletonCard: React.FC<{ delay: number }> = ({ delay }) => (
  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3 animate-pulse" style={{ animationDelay: `${delay}ms` }}>
    <div className="w-14 h-14 rounded-full bg-white/[0.06] shrink-0" />
    <div className="flex-1">
      <div className="h-4 rounded-lg bg-white/10 w-2/3" />
      <div className="h-3 rounded-lg bg-white/[0.07] w-1/3 mt-2" />
    </div>
  </div>
);

export const StaffSection: React.FC<StaffSectionProps> = ({ lang }) => {
  const [mods, setMods] = useState<ModLive[] | null>(null);
  const isAr = lang === 'ar';

  useEffect(() => {
    let dead = false;
    (async () => {
      const out = await Promise.all(
        MODS.map(async (m): Promise<ModLive> => {
          const fb: ModLive = { handle: m.handle, name: `@${m.handle}`, bio: '', followers: 0, avatar: '', verified: false, head: !!m.head };
          try {
            const r = await fetch(`https://api.fxtwitter.com/${m.handle}`);
            if (!r.ok) return fb;
            const j = await r.json();
            const u = j?.user;
            if (!u) return fb;
            return {
              handle: u.screen_name || m.handle,
              name: u.name || `@${m.handle}`,
              bio: String(u.description || '').split('\n')[0].slice(0, 90),
              followers: Number(u.followers) || 0,
              avatar: String(u.avatar_url || '').replace('_normal.', '_400x400.'),
              verified: Boolean(u.verification?.verified),
              head: !!m.head,
            };
          } catch {
            return fb;
          }
        })
      );
      if (!dead) setMods(out);
    })();
    return () => { dead = true; };
  }, []);

  const head = mods?.find((m) => m.head);
  const rest = mods?.filter((m) => !m.head) || [];

  const Card: React.FC<{ m: ModLive; i: number }> = ({ m, i }) => (
    <a href={`https://x.com/${m.handle}`} target="_blank" rel="noopener noreferrer"
      style={{ animationDelay: `${Math.min(i * 60, 500)}ms` }}
      className={`group relative block rounded-[22px] border backdrop-blur-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 animate-fade-in-up ${
        m.head
          ? 'border-[#E10600]/50 bg-gradient-to-b from-[#E10600]/[0.12] to-white/[0.03] shadow-[0_0_40px_-10px_rgba(225,6,0,0.5)]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]'
      }`}>
      <span className="absolute top-0 start-6 end-6 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#E10600]/70 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
      <div className="relative p-4 flex items-center gap-3.5">
        <span className="relative shrink-0">
          <span className={`block rounded-full overflow-hidden border-2 bg-black ${m.head ? 'w-16 h-16 border-[#E10600]/70 shadow-[0_0_24px_rgba(225,6,0,0.5)]' : 'w-14 h-14 border-white/20'}`}>
            {m.avatar
              ? <img src={m.avatar} alt={m.name} loading="lazy" className="w-full h-full object-cover" />
              : <span className="w-full h-full flex items-center justify-center text-lg font-black text-white/70">{m.handle.charAt(0).toUpperCase()}</span>}
          </span>
          {m.head && (
            <span className="absolute -top-1.5 -end-1.5 w-7 h-7 rounded-full bg-[#E10600] border-2 border-[#0d0606] flex items-center justify-center shadow-[0_0_14px_rgba(225,6,0,0.8)]" title={isAr ? 'المشرف الرئيسي' : 'Head mod'}>
              <svg className="w-3.5 h-3.5 text-white fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="font-black text-white truncate text-[15px]" dir="auto">{m.name}</span>
            {m.verified && (
              <svg className="w-4 h-4 text-[#1D9BF0] shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 2.4 3.4-.5 1 3.3 3 1.6-1.4 3.2 1.4 3.2-3 1.6-1 3.3-3.4-.5L12 22l-2.4-2.4-3.4.5-1-3.3-3-1.6L3.6 12 2.2 8.8l3-1.6 1-3.3 3.4.5L12 2zm-1.1 12.4l4.5-4.5-1.4-1.4-3.1 3.1-1.5-1.5-1.4 1.4 2.9 2.9z" /></svg>
            )}
          </span>
          <span className="block text-[11px] text-white/40 font-bold truncate" dir="ltr">@{m.handle}</span>
          <span className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[9px] font-black tracking-[0.14em] px-2 py-[3px] rounded-lg border ${
              m.head ? 'bg-[#E10600]/15 border-[#E10600]/50 text-[#FF8A8A]' : 'bg-white/[0.05] border-white/10 text-white/50'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${m.head ? 'bg-[#E10600] animate-pulse' : 'bg-white/30'}`} />
              {m.head ? (isAr ? 'الرئيسي' : 'HEAD') : (isAr ? 'مشرف' : 'MOD')}
            </span>
            {m.followers > 0 && (
              <span className="text-[10px] font-black text-white/50" dir="ltr">{fmtNum(m.followers)}</span>
            )}
          </span>
        </span>
        <span className="shrink-0 w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/60 group-hover:bg-black group-hover:text-white group-hover:border-white/40 transition-all">
          <XIcon className="w-4 h-4" />
        </span>
      </div>
      {m.bio && <p className="relative px-4 pb-4 -mt-1 text-[11px] text-white/40 font-medium truncate" dir="auto">{m.bio}</p>}
    </a>
  );

  return (
    <div className="w-full">
      <div className="relative rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-2xl overflow-hidden">
        <div className="absolute -top-20 start-1/3 w-96 h-96 rounded-full bg-[#E10600]/[0.08] blur-[100px] pointer-events-none" aria-hidden="true" />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-[#E10600]/60 to-transparent" aria-hidden="true" />
        <div className="relative p-4 sm:p-6">
          {!mods ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} delay={i * 60} />)}
            </div>
          ) : (
            <>
              {head && (
                <div className="mb-3">
                  <Card m={head} i={0} />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                {rest.map((m, i) => <Card key={m.handle} m={m} i={i + 1} />)}
              </div>
            </>
          )}
        </div>
        <div className="relative px-5 pb-5 flex items-center justify-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-white/40 bg-white/[0.04] border border-white/10 rounded-full px-3.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] animate-pulse shadow-[0_0_8px_#E10600]" />
            {isAr ? 'عيون القلعة الساهرة' : 'Eyes of the fortress'}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>
      </div>
    </div>
  );
};

export default StaffSection;
