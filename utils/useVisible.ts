import { useEffect, useRef, useState } from 'react';

/**
 * Becomes true once the attached element is near the viewport (once).
 * Use it to defer below-fold network fetches until the user scrolls close —
 * this removes the load-time request storm that hangs low-end phones.
 */
export function useVisible(margin = '400px') {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        }
      },
      { rootMargin: `0px 0px ${margin} 0px`, threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [margin]);

  return [ref, visible] as const;
}
