"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Reveals page blocks as they scroll in, staggered among siblings. Re-runs on every route.
 * Checks positions on scroll rather than through IntersectionObserver, so content never stays hidden
 * in a browser that throttles observers.
 */
export function Reveal() {
  const path = usePathname();
  useEffect(() => {
    const show = () => {
      const edge = innerHeight * 0.92;
      document.querySelectorAll<HTMLElement>("main .rv:not(.in)").forEach((el) => {
        if (el.getBoundingClientRect().top < edge) el.classList.add("in");
      });
    };
    const scan = () => {
      document.querySelectorAll<HTMLElement>("main .wrap > *, main .card, main table.t tbody tr").forEach((el) => {
        if (el.closest(".rise") || el.classList.contains("rv")) return;
        const i = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
        el.classList.add("rv");
        el.style.setProperty("--d", `${Math.min(i, 5) * 80}ms`);
      });
      // A beat after marking, so the transition plays from the hidden state.
      setTimeout(show, 50);
    };
    // Data rows arrive after the first paint, so newly mounted blocks are picked up too.
    const mo = new MutationObserver(scan);
    const main = document.querySelector("main");
    scan();
    if (main) mo.observe(main, { childList: true, subtree: true });
    addEventListener("scroll", show, { passive: true });
    addEventListener("resize", show);
    return () => (mo.disconnect(), removeEventListener("scroll", show), removeEventListener("resize", show));
  }, [path]);
  return null;
}
