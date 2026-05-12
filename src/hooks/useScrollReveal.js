import { useEffect } from 'react';

// Tiny scroll-reveal helper — flips `.is-visible` on `.reveal` elements
// when they enter the viewport. Pure CSS handles the actual transition;
// JS only adds the class. Use this in pages that render long scrolling
// content (HomePage / PromoPage) for a Smartor-style entrance feel.
//
// Honors `prefers-reduced-motion` automatically: the CSS for `.reveal`
// already short-circuits the transition under reduce-motion, so even
// when we toggle the class nothing visible animates.

export function useScrollReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const els = document.querySelectorAll('.reveal:not(.is-visible)');
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
