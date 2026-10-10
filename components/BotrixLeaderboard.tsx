import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useVisible } from '../utils/useVisible';

interface BotrixEntry {
  watchtime: number;
  points: number;
  name: string;
}

interface BotrixLeaderboardProps {
  lang: 'en' | 'ar';
}

const API_URL = '/api/kick?endpoint=' + encodeURIComponent('https://botrix.live/api/public/leaderboard?platform=kick&user=oflag');
const KICK_CH = (name: string) => '/api/kick?endpoint=' + encodeURIComponent(`https://kick.com/api/v2/channels/${name}`);

/* Kick avatars — lazy per-user fetch, cached for the session */
const AVATAR_CACHE = new Map<string, string>();

/* Botrix watchtime unit = minutes.
   12365 -> 8d 14h 5m  =>  d = v/1440, h = (v%1440)/60, m = v%60 */
const splitWatchtime = (mins: number) => {
  const v = Math.max(0, Math.floor(Number(mins) || 0));
  return { d: Math.floor(v / 1440), h: Math.floor((v % 1440) / 60), m: v % 60 };
};

const arUnit = (v: number, one: string, two: string, many: string) =>
  v === 1 ? one : v === 2 ? two : `${v.toLocaleString('en-US')} ${many}`;

const formatWatchtime = (mins: number, lang: 'en' | 'ar') => {
  const { d, h, m } = splitWatchtime(mins);
  if (lang === 'ar') {
    const parts: string[] = [];
    if (d > 0) parts.push(arUnit(d, 'يوم', 'يومين', 'أيام'));
    if (h > 0) parts.push(arUnit(h, 'ساعة', 'ساعتين', 'ساعة'));
    if (m > 0 || parts.length === 0) parts.push(arUnit(m, 'دقيقة', 'دقيقتين', 'دقايق'));
    return parts.join(' و ');
  }
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(' ');
};

const formatNum = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return (n || 0).toLocaleString('en-US');
};

const SkeletonRow: React.FC<{ delay: number }> = ({ delay }) => (
  <div className="flex items-center gap-3 p-3 md:p-4 rounded-2xl bg-white/[0.02] animate-pulse" style={{ animationDelay: `${delay}ms` }}>
    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-white/[0.04]"></div>
    <div className="flex-1 space-y-2">
      <div className="h-3 w-28 bg-white/[0.04] rounded-lg"></div>
      <div className="h-2 w-36 bg-white/[0.02] rounded-lg"></div>
    </div>
    <div className="w-16 h-5 bg-white/[0.04] rounded-lg"></div>
  </div>
);

const BotrixLeaderboard: React.FC<BotrixLeaderboardProps> = ({ lang }) => {
  const [data, setData] = useState<BotrixEntry[] | null>(null);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const fetchedRef = useRef<Set<string>>(new Set());
  const [visRef, visible] = useVisible();

  useEffect(() => {
    if (!visible) return; // deferred until near viewport
    let cancelled = false;
    fetch(API_URL)
      .then(r => r.json())
      .then((json: any[]) => {
        if (cancelled) return;
        if (!Array.isArray(json)) { setData([]); return; }
        // Only watchtime + points from the API, ranked by most watched
        const clean: BotrixEntry[] = json
          .filter(e => e && typeof e?.name === 'string')
          .map(e => ({
            name: String(e.name),
            watchtime: Math.max(0, Math.floor(Number(e.watchtime) || 0)),
            points: Math.max(0, Math.floor(Number(e.points) || 0)),
          }))
          .sort((a, b) => (b.watchtime || 0) - (a.watchtime || 0))
          .slice(0, 50);
        setData(clean);
      })
      .catch(() => { if (!cancelled) setData([]); });
    return () => { cancelled = true; };
  }, [visible]);

  const rich = useMemo(() => data || [], [data]);

  // Enrich every legend with their Kick profile picture (lazy, batched, cached)
  useEffect(() => {
    if (!rich.length) return;
    const toFetch = rich.map(e => e.name).filter(n => !fetchedRef.current.has(n.toLowerCase()));
    if (!toFetch.length) return;
    toFetch.forEach(n => fetchedRef.current.add(n.toLowerCase()));
    let cancelled = false;
    const fetchOne = async (name: string) => {
      try {
        const cached = AVATAR_CACHE.get(name.toLowerCase());
        if (cached !== undefined) return { name, avatar: cached };
        const res = await fetch(KICK_CH(name));
        if (!res.ok) return null;
        const json = await res.json();
        const d = json?.data || json;
        const avatar = d?.user?.profile_pic || '';
        AVATAR_CACHE.set(name.toLowerCase(), avatar);
        return { name, avatar };
      } catch { return null; }
    };
    (async () => {
      for (let i = 0; i < toFetch.length; i += 4) {
        const batch = await Promise.all(toFetch.slice(i, i + 4).map(fetchOne));
        if (cancelled) return;
        const next: Record<string, string> = {};
        batch.forEach(b => { if (b) next[b.name] = b.avatar; });
        setAvatars(prev => ({ ...prev, ...next }));
      }
    })();
    return () => { cancelled = true; };
  }, [rich]);

  const maxWatch = Math.max(1, ...rich.map(e => e.watchtime || 0));
  const totalWatch = rich.reduce((s, e) => s + (e.watchtime || 0), 0);
  const totalPoints = rich.reduce((s, e) => s + (e.points || 0), 0);

  const t = {
    title: lang === 'ar' ? 'أساطير الشات' : 'Chat Legends',
    subtitle: lang === 'ar' ? 'الأعلى مشاهدة في جميع البثوث' : 'Most watched across all streams',
    empty: lang === 'ar' ? 'لا توجد بيانات حالياً' : 'No data available',
    watched: lang === 'ar' ? 'مشاهدة' : 'Watched',
    points: lang === 'ar' ? 'نقطة' : 'PTS',
    legends: lang === 'ar' ? 'أسطورة' : 'Legends',
  };

  const podium = rich.slice(0, 3);
  const ringOf = (rank: number) =>
    rank === 1 ? 'conic-gradient(from 200deg,#FFCFCF,#E10600,#ffffff,#7A0A0A,#FFCFCF)'
    : rank === 2 ? 'conic-gradient(from 200deg,#e8e8e8,#6f7b8a,#ffffff,#6f7b8a,#e8e8e8)'
    : rank === 3 ? 'conic-gradient(from 200deg,#f0a35e,#6e3c10,#ffd9ae,#6e3c10,#f0a35e)'
    : 'rgba(255,255,255,0.12)';

  return (
    <div ref={visRef} className="w-full animate-fade-in-up">
      <div className="group relative rounded-[28px] overflow-hidden bg-white/[0.03] border border-white/10 backdrop-blur-2xl transition-colors duration-500 hover:border-[#E10600]/30">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-[#E10600]/60 to-transparent" aria-hidden="true" />
        <div className="absolute -top-24 start-1/4 w-96 h-96 bg-[#E10600]/[0.08] blur-[110px] pointer-events-none" aria-hidden="true" />
        <div className="absolute -bottom-32 end-0 w-96 h-96 bg-[#E10600]/[0.08] blur-[110px] pointer-events-none" aria-hidden="true" />

        {/* header */}
        <div className="relative p-5 md:p-7 pb-4 flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="absolute -inset-2 bg-[#E10600]/40 blur-2xl opacity-40 group-hover:opacity-80 transition-opacity duration-500 rounded-full" aria-hidden="true" />
            <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-[20px] bg-[#0d0606] border border-[#E10600]/50 shadow-[0_16px_40px_-12px_rgba(225,6,0,0.6)] flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6 ring-1 ring-white/10">
              <svg className="w-7 h-7 md:w-8 md:h-8 text-[#FF2233] drop-shadow-[0_0_12px_rgba(225,6,0,0.7)]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
            </div>
            <span className="absolute -bottom-1.5 -end-1.5 w-6 h-6 rounded-full bg-[#53FC18] border-4 border-[#0d0606] animate-pulse shadow-[0_0_14px_#53FC18]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl md:text-2xl font-black text-white tracking-tight leading-none">{t.title}</h3>
            <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.24em] bg-gradient-to-r from-[#FFCFCF] to-[#B3000F] bg-clip-text text-transparent mt-2">{t.subtitle}</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-3.5 py-2 rounded-2xl bg-white/[0.05] border border-white/10 text-white/60">{rich.length} {t.legends}</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-3.5 py-2 rounded-2xl bg-[#E10600]/10 border border-[#E10600]/30 text-[#FF8A8A]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>{formatWatchtime(totalWatch, lang)}</span>
          </div>
        </div>

        <div className="relative px-4 md:px-8 pb-4 z-10">
          {!data && (
            <div className="space-y-1.5">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} delay={i * 60} />)}
            </div>
          )}

          {data && data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4 border border-white/[0.06]">
                <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.72m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
              </div>
              <p className="text-sm text-white/30 font-medium">{t.empty}</p>
            </div>
          )}

          {rich.length > 0 && (
            <>
              {/* podium top-3 — ranked purely by watchtime */}
              <div className="relative mx-4 md:mx-6 mt-1 rounded-3xl border border-white/[0.07] bg-black/30 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" aria-hidden="true" />
                <div className="relative flex items-end justify-center gap-2 sm:gap-5 px-4 pt-6 pb-4" dir="ltr">
                {([podium[1], podium[0], podium[2]].filter(Boolean)).map((e: any, i: number) => {
                  const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
                  return (
                    <div key={e.name} className="flex flex-col items-center w-[30%] max-w-[200px] animate-fade-in-up transition-transform duration-500 hover:-translate-y-1.5" style={{ animationDelay: `${i * 100}ms` }}>
                      <span className={`relative rounded-full p-[2.5px] block transition-transform duration-500 hover:scale-110 ${rank === 1 ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-12 h-12 sm:w-16 sm:h-16'}`} style={{ background: ringOf(rank), boxShadow: rank === 1 ? '0 0 36px rgba(225,6,0,0.55)' : '0 8px 24px rgba(0,0,0,0.5)' }}>
                        {avatars[e.name]
                          ? <img src={avatars[e.name]} alt={e.name} loading="lazy" className="w-full h-full rounded-full object-cover bg-black" />
                          : <span className="w-full h-full rounded-full bg-white/[0.06] backdrop-blur flex items-center justify-center font-black text-lg text-white/80">{e.name.charAt(0).toUpperCase()}</span>}
                        <span className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-black px-2 py-0.5 rounded-lg border ${rank === 1 ? 'bg-[#E10600] text-white border-white/50' : 'bg-black/80 text-white/80 border-white/20'}`} dir="ltr">#{rank}</span>
                        {rank === 1 && (
                          <svg className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 sm:w-7 sm:h-7 drop-shadow-[0_0_10px_rgba(225,6,0,0.9)] animate-float-soft" viewBox="0 0 24 24" fill="none">
                            <path fill="#FF8A8A" d="M2.5 8.5 6.5 12l5.5-7 5.5 7 4-3.5L20 18H4L2.5 8.5z" />
                            <rect x="4" y="18.6" width="16" height="2.2" rx="1.1" fill="#7A0A0A" />
                          </svg>
                        )}
                      </span>
                      <p className="mt-3 text-xs sm:text-sm font-black text-white truncate max-w-full" dir="auto">{e.name}</p>
                      <span className="mt-1.5 text-[10px] sm:text-[11px] font-black text-[#FF8A8A]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>{formatWatchtime(e.watchtime, lang)}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/10 text-white/60" dir="ltr">
                        <svg className="w-3 h-3 text-[#FFD166]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                        {formatNum(e.points)}
                      </span>
                    </div>
                  );
                })}
                </div>
              </div>

              {/* rows — watchtime + points only */}
              <div className="space-y-1.5 mt-3 max-h-[420px] md:max-h-[520px] overflow-y-auto scrollbar-hide">
                {rich.slice(3).map((e, idx) => {
                  const rank = idx + 4;
                  const pct = Math.max(4, Math.round(((e.watchtime || 0) / maxWatch) * 100));
                  return (
                    <div key={e.name} className="relative rounded-2xl p-2.5 sm:p-3 border border-transparent hover:border-[#E10600]/25 hover:bg-white/[0.04] hover:-translate-y-0.5 hover:shadow-[0_16px_38px_-14px_rgba(225,6,0,0.35)] transition-all duration-300 animate-fade-in-up" style={{ animationDelay: `${Math.min(idx * 60, 480)}ms` }}>
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-[11px] font-black text-white/40 shrink-0" dir="ltr">{rank < 10 ? `0${rank}` : rank}</span>
                        <span className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/[0.06] border border-white/10 shrink-0 block overflow-hidden">
                          {avatars[e.name]
                            ? <img src={avatars[e.name]} alt={e.name} loading="lazy" className="w-full h-full rounded-full object-cover bg-black" />
                            : <span className="w-full h-full rounded-full flex items-center justify-center text-sm font-black text-white/70">{e.name.charAt(0).toUpperCase()}</span>}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] sm:text-sm font-black text-white/90 truncate" dir="auto">{e.name}</p>
                          <p className="mt-1 flex items-center gap-2 text-[10px] font-bold" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#E10600]/10 border border-[#E10600]/25 px-1.5 py-0.5 text-[#FF8A8A]">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              {formatWatchtime(e.watchtime, lang)}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] border border-white/10 px-1.5 py-0.5 text-white/60" dir="ltr">
                              <svg className="w-3 h-3 text-[#FFD166]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                              {formatNum(e.points)}
                            </span>
                          </p>
                        </div>
                        <span className="text-[11px] font-black px-2.5 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 text-white/60 shrink-0" dir="ltr">{formatNum(e.points)} {t.points}</span>
                      </div>
                      <div className="mt-2 ms-[76px] h-1 rounded-full bg-white/[0.06] overflow-hidden" dir="ltr">
                        <div className="bar-grow h-full rounded-full bg-gradient-to-r from-[#FFCFCF] via-[#E10600] to-[#4A0200]" style={{ width: `${pct}%`, boxShadow: '0 0 10px rgba(225,6,0,0.6)', animationDelay: `${idx * 80}ms` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="h-3"></div>
              </div>
            </>
          )}
        </div>

        <div className="relative px-5 md:px-7 pb-5 flex items-center justify-center gap-3 z-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent"></div>
          <span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-white/40 bg-white/[0.04] border border-white/10 rounded-full px-3.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#53FC18] animate-pulse shadow-[0_0_8px_#53FC18]" />
            {lang === 'ar' ? 'نخبة الشات المباشر' : 'Live chat elite'}
            {totalPoints > 0 && <span className="text-[#FFD166]" dir="ltr">• {formatNum(totalPoints)}</span>}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent"></div>
        </div>
      </div>
    </div>
  );
};

export default BotrixLeaderboard;
