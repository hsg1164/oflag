import React, { useEffect, useState } from 'react';
import type { Language } from '../types';

interface RosterEntry {
  x: string;
  kick?: string;
  boss?: boolean;
}

// 11 OFLAG moderators — X handles live via FixTweet, Kick names matched from Botrix leaderboard
const ROSTER: RosterEntry[] = [
  { x: 'itsxAREEJ1', kick: 'xAREEJ1', boss: true },
  { x: 's7_moataz', kick: 'M0ATAZ' },
  { x: 'iriliir_5' },
  { x: 'i_fares_0i', kick: 'oiFares' },
  { x: 'sa3bood911' },
  { x: 'vghalaa1', kick: 'vghala1' },
  { x: 'iey52', kick: '2Yaseer' },
  { x: '_aishilad', kick: 'AISHILAD' },
  { x: '_a7medo_' },
  { x: 's7le_a' },
  { x: '2nellyy' },
];

interface ModProfile {
  name: string;
  handle: string;
  avatar: string;
  banner: string;
  bio: string;
  followers: number | null;
  tweets: number | null;
  live: boolean;
}

const CACHE_KEY = 'oflag_mods_cache_v1';
const CACHE_TTL_MS = 30 * 60 * 1000;
const REFRESH_MS = 10 * 60 * 1000;

const compact = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return '---';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
};

async function fetchJson(url: string, timeoutMs = 10000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Layer 1: server proxy (no CORS) → Layer 2: direct FixTweet → Layer 3: static fallback (null)
async function fetchMod(handle: string): Promise<ModProfile | null> {
  const target = `https://api.fxtwitter.com/${handle}`;
  let user: any = null;
  try {
    const via = await fetchJson('/api/kick?endpoint=' + encodeURIComponent(target));
    user = via?.user || null;
  } catch {}
  if (!user) {
    try {
      const direct = await fetchJson(target);
      user = direct?.user || null;
    } catch {}
  }
  if (!user) return null;
  const avatarRaw: string = user.avatar_url || '';
  const bannerRaw: string = user.banner_url || '';
  return {
    name: user.name || handle,
    handle: user.screen_name || handle,
    avatar: avatarRaw ? avatarRaw.replace('_normal.', '_400x400.') : '',
    banner: bannerRaw ? `${bannerRaw}/1500x500` : '',
    bio: String(user.description || '').split('\n')[0].slice(0, 120),
    followers: typeof user.followers === 'number' ? user.followers : null,
    tweets: typeof user.tweets === 'number' ? user.tweets : null,
    live: true,
  };
}

function readCache(): { at: number; data: Record<string, ModProfile> } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

/* ---------- local SVG icons (no external libs) ---------- */
const XIconSmall = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const KickIconSmall = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 3h4.5v6.9l6-6.9H19l-7.5 8.4L20 21h-5.4l-5.1-6.6V21H3V3z" />
  </svg>
);

const CrownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M2.5 8.5 6.5 12l5.5-7 5.5 7 4-3.5L20 18H4L2.5 8.5z" />
    <rect x="4" y="18.6" width="16" height="2.2" rx="1.1" />
  </svg>
);

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
    <path d="M9.5 12l2 2 3.5-4" />
  </svg>
);

/* ---------- image-safe primitives (broken URLs degrade gracefully) ---------- */
const SafeAvatar: React.FC<{ src: string; name: string; handle: string; big?: boolean }> = ({ src, name, handle, big }) => {
  const [ok, setOk] = useState(true);
  useEffect(() => { setOk(true); }, [src]);
  if (!src || !ok) {
    return (
      <span className={`w-full h-full rounded-full bg-white/[0.06] flex items-center justify-center font-black text-white/70 ${big ? 'text-2xl' : 'text-lg'}`}>
        {handle.charAt(0).toUpperCase()}
      </span>
    );
  }
  return <img src={src} alt={name} loading="lazy" onError={() => setOk(false)} className="w-full h-full rounded-full object-cover bg-black" />;
};

const SafeBanner: React.FC<{ src: string; hoverFx?: boolean }> = ({ src, hoverFx }) => {
  const [ok, setOk] = useState(true);
  useEffect(() => { setOk(true); }, [src]);
  if (!src || !ok) return <div className="absolute inset-0 bg-gradient-to-tr from-[#E10600]/30 via-transparent to-[#FF2233]/20" />;
  return (
    <img src={src} alt="" loading="lazy" onError={() => setOk(false)}
      className={`absolute inset-0 w-full h-full object-cover ${hoverFx ? 'opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500' : ''}`} />
  );
};

/* ---------- section ---------- */
const ModeratorsSection: React.FC<{ lang: Language }> = ({ lang }) => {
  const [profiles, setProfiles] = useState<Record<string, ModProfile>>(() => readCache()?.data || {});
  const [loading, setLoading] = useState(true);
  const isAr = lang === 'ar';

  const t = {
    mod: isAr ? 'مشرف' : 'MOD',
    followers: isAr ? 'متابع' : 'Followers',
    posts: isAr ? 'منشور' : 'Posts',
    follow: isAr ? 'تابع' : 'Follow',
    viewKick: 'Kick',
  };

  useEffect(() => {
    let cancelled = false;
    const load = async (useCacheFirst = true) => {
      const cached = readCache();
      const fresh = cached && Date.now() - cached.at < CACHE_TTL_MS;
      if (useCacheFirst && fresh) {
        setProfiles(cached.data);
        setLoading(false);
        return;
      }
      const next: Record<string, ModProfile> = {};
      for (let i = 0; i < ROSTER.length; i += 3) {
        const batch = await Promise.all(
          ROSTER.slice(i, i + 3).map(async (m) => {
            try {
              return await fetchMod(m.x);
            } catch {
              return null;
            }
          })
        );
        if (cancelled) return;
        batch.forEach((p) => {
          if (p) next[p.handle.toLowerCase()] = p;
        });
        setProfiles((prev) => ({ ...prev, ...next }));
      }
      if (!cancelled) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: { ...readCache()?.data, ...next } }));
        } catch {}
        setLoading(false);
      }
    };
    load(true);
    const timer = setInterval(() => load(false), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const get = (x: string): ModProfile => {
    const p = profiles[x.toLowerCase()];
    if (p) return p;
    const r = ROSTER.find((m) => m.x.toLowerCase() === x.toLowerCase());
    return {
      name: r?.kick || `@${x}`,
      handle: x,
      avatar: '',
      banner: '',
      bio: '',
      followers: null,
      tweets: null,
      live: false,
    };
  };

  const bossEntry = ROSTER.find((m) => m.boss) || ROSTER[0];
  const restEntries = ROSTER.filter((m) => m !== bossEntry);
  const bossP = get(bossEntry.x);

  const FollowBtn: React.FC<{ handle: string; label?: string; big?: boolean }> = ({ handle, label, big }) => (
    <a href={`https://x.com/${handle}`} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-1.5 font-black transition-colors ${
        big
          ? 'btn-arena px-7 py-3 rounded-2xl bg-white text-black text-sm hover:bg-[#E10600] hover:text-white shadow-[0_14px_36px_-10px_rgba(255,255,255,0.35)]'
          : 'px-5 h-10 rounded-xl bg-white/[0.06] border border-white/10 text-white/80 text-[12px] hover:bg-white hover:text-black'
      }`}>
      <XIconSmall className="w-3.5 h-3.5" />
      {label || t.follow}
    </a>
  );

  const KickBtn: React.FC<{ kick?: string; square?: boolean }> = ({ kick, square }) => {
    if (!kick) return null;
    return (
      <a href={`https://kick.com/${kick}`} target="_blank" rel="noopener noreferrer" aria-label={`Kick ${kick}`}
        className={`inline-flex items-center justify-center gap-1.5 font-black transition-colors ${
          square
            ? 'w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 text-white/80 text-[12px] hover:bg-[#53FC18] hover:text-black hover:border-[#53FC18]'
            : 'btn-arena px-6 py-3 rounded-2xl bg-white/[0.05] border border-white/15 text-white text-sm hover:bg-[#53FC18] hover:text-black hover:border-[#53FC18]'
        }`}>
        <KickIconSmall className="w-4 h-4" />
        {!square && t.viewKick}
      </a>
    );
  };

  const StatBox: React.FC<{ value: string; label: string }> = ({ value, label }) => (
    <span className="inline-flex flex-col items-center px-5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 min-w-[76px]">
      <span className="text-lg font-black text-[#FF8A8A]" dir="ltr">{value}</span>
      <span className="text-[9px] font-bold text-white/40 mt-0.5">{label}</span>
    </span>
  );

  return (
    <div className="w-full animate-fade-in-up">
      <div className="relative rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-2xl overflow-hidden">
        <div className="absolute -top-20 start-1/3 w-96 h-96 rounded-full bg-[#E10600]/[0.08] blur-[100px] pointer-events-none" aria-hidden="true" />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-[#E10600]/60 to-transparent" aria-hidden="true" />
        <div className="relative p-4 sm:p-6 md:p-7">
          {/* sync bar */}
          <div className={`h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06] mb-4 md:mb-6 transition-opacity duration-700 ${loading ? 'opacity-100' : 'opacity-0'}`}>
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-[#E10600] to-transparent animate-pulse" />
          </div>

          {/* ===== BOSS HERO — avatar right, stats left, bio center, buttons ===== */}
          <div className="relative rounded-[28px] p-[1.5px] bg-gradient-to-b from-[#FF8A8A] via-[#E10600]/50 to-transparent shadow-[0_30px_90px_rgba(225,6,0,0.25)] mb-4 md:mb-6 overflow-hidden">
            <div className="relative rounded-[26.5px] bg-[#0d0606] overflow-hidden">
              <div className="relative h-40 sm:h-52 md:h-60 overflow-hidden bg-black shrink-0">
                {bossP.banner ? (
                  <SafeBanner src={bossP.banner} />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#E10600]/30 via-transparent to-[#FF2233]/20" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-[#0d0606]/40 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-[#0d0606] via-[#0d0606]/60 to-transparent" />
                <a href={`https://x.com/${bossP.handle}`} target="_blank" rel="noopener noreferrer" aria-label="X profile"
                  className="absolute top-3 end-3 w-9 h-9 rounded-xl bg-black/55 backdrop-blur border border-white/15 text-white/85 hover:text-white hover:border-[#E10600]/60 flex items-center justify-center transition-colors">
                  <XIconSmall className="w-4 h-4" />
                </a>
                <span className="absolute top-3 start-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E10600] text-white text-[10px] font-black tracking-[0.18em] shadow-[0_0_22px_rgba(225,6,0,0.7)]" dir="ltr">
                  <CrownIcon className="w-3.5 h-3.5" /> BOSS
                </span>
              </div>
              {/* identity row: avatar+name right … stats left */}
              <div className="relative px-5 sm:px-7 -mt-10 sm:-mt-12 flex items-end gap-4">
                <span className="relative shrink-0">
                  <CrownIcon className="absolute -top-5 left-1/2 -translate-x-1/2 w-7 h-7 text-[#FF4D5A] drop-shadow-[0_0_10px_rgba(225,6,0,0.9)] animate-float-soft" />
                  <span className="relative rounded-full p-[3px] w-20 h-20 sm:w-24 sm:h-24 block"
                    style={{ background: 'conic-gradient(from 200deg,#FFCFCF,#E10600,#ffffff,#7A0A0A,#FFCFCF)', boxShadow: '0 0 44px rgba(225,6,0,0.55)' }}>
                    <SafeAvatar src={bossP.avatar} name={bossP.name} handle={bossP.handle} big />
                    {bossP.live && <span className="absolute bottom-1 end-1 w-4 h-4 rounded-full bg-[#53FC18] border-[3px] border-[#0d0606] shadow-[0_0_10px_#53FC18]" />}
                  </span>
                </span>
                <div className="min-w-0 flex-1 pb-1">
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none flex items-center gap-2 flex-wrap" dir="ltr">
                    <span className="truncate">{bossP.name}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-[#53FC18]/15 border border-[#53FC18]/40 text-[#53FC18]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#53FC18] animate-pulse" />@{bossP.handle}
                    </span>
                  </h3>
                  {bossEntry.kick && <p className="text-[11px] font-bold text-[#FF8A8A]/80 mt-1.5" dir="ltr">KICK: {bossEntry.kick}</p>}
                </div>
                <div className="hidden sm:flex items-center gap-2 shrink-0 pb-1">
                  <StatBox value={compact(bossP.tweets)} label={t.posts} />
                  <StatBox value={compact(bossP.followers)} label={t.followers} />
                </div>
              </div>
              {/* mobile stats */}
              <div className="flex sm:hidden items-center justify-center gap-2 px-5 mt-3">
                <StatBox value={compact(bossP.tweets)} label={t.posts} />
                <StatBox value={compact(bossP.followers)} label={t.followers} />
              </div>
              {bossP.bio && (
                <p className="relative px-5 sm:px-7 mt-4 text-[13px] text-white/55 font-medium leading-relaxed text-center max-w-3xl mx-auto" dir="auto">{bossP.bio}</p>
              )}
              <div className="relative px-5 sm:px-7 py-5 flex items-center justify-start gap-2.5">
                <KickBtn kick={bossEntry.kick} />
                <FollowBtn handle={bossP.handle} label={`${t.follow} @${bossP.handle}`} big />
              </div>
            </div>
          </div>

          {/* ===== MODS GRID ===== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {restEntries.map((entry, i) => {
              const p = get(entry.x);
              return (
                <div key={entry.x} style={{ animationDelay: `${Math.min(i * 60, 480)}ms` }}
                  className="group relative rounded-[22px] border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden hover:border-[#E10600]/50 hover:-translate-y-1 hover:shadow-[0_24px_60px_-16px_rgba(225,6,0,0.35)] transition-all duration-300 animate-fade-in-up">
                  <div className="relative h-20 sm:h-24 overflow-hidden bg-black">
                    {p.banner ? (
                      <SafeBanner src={p.banner} hoverFx />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-tr from-[#E10600]/25 via-transparent to-[#FF2233]/15" />
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-[#0d0606] via-[#0d0606]/40 to-transparent" />
                    <span className="absolute top-2.5 start-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/55 backdrop-blur border border-[#E10600]/40 text-[#FF8A8A] text-[9px] font-black tracking-[0.16em]">
                      <ShieldIcon className="w-3 h-3" />{t.mod}
                    </span>
                    <a href={`https://x.com/${p.handle}`} target="_blank" rel="noopener noreferrer" aria-label="X profile"
                      className="absolute top-2.5 end-3 w-8 h-8 rounded-lg bg-black/55 backdrop-blur border border-white/15 text-white/80 hover:text-white hover:border-white/50 flex items-center justify-center transition-colors">
                      <XIconSmall className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="relative px-4 pb-3 -mt-7 flex items-end gap-3">
                    <span className="relative rounded-full p-[2px] w-14 h-14 shrink-0 block"
                      style={{ background: 'linear-gradient(160deg,#FF8A8A,#E10600 55%,#4A0200)' }}>
                      <SafeAvatar src={p.avatar} name={p.name} handle={p.handle} />
                      {p.live && <span className="absolute bottom-0 end-0 w-3.5 h-3.5 rounded-full bg-[#53FC18] border-2 border-[#0d0606] shadow-[0_0_10px_#53FC18]" />}
                    </span>
                    <div className="min-w-0 flex-1 pb-0.5">
                      <p className="font-black text-white truncate text-[15px]" dir="ltr">{p.name}</p>
                      <p className="text-[11px] text-white/40 font-bold truncate" dir="ltr">@{p.handle}</p>
                      {entry.kick
                        ? <p className="text-[10px] font-bold text-[#FF8A8A] truncate mt-0.5" dir="ltr">KICK: {entry.kick}</p>
                        : <p className="text-[10px] font-bold text-white/25 truncate mt-0.5" dir="ltr">OFLAG STAFF</p>}
                    </div>
                  </div>
                  <p className="relative px-4 text-[11px] text-white/40 font-medium leading-relaxed line-clamp-2 min-h-[32px]" dir="auto">{p.bio || '---'}</p>
                  <div className="relative px-4 pb-4 pt-2.5 flex items-center gap-2">
                    <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10">
                      <span className="text-[#FF8A8A]" dir="ltr">{compact(p.followers)}</span>
                      <span className="text-white/35 font-bold">{t.followers}</span>
                    </span>
                    <span className="flex-1" />
                    <KickBtn kick={entry.kick} square />
                    <FollowBtn handle={p.handle} />
                  </div>
                  <span className="absolute bottom-0 start-0 h-[2px] w-0 group-hover:w-full bg-gradient-to-r from-[#FF8A8A] to-[#E10600] transition-all duration-500" />
                </div>
              );
            })}
          </div>
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

export default ModeratorsSection;
