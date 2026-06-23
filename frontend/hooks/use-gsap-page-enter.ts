"use client";

import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import { gsap } from "@/lib/gsapConfig";

/** Subtle page content fade-up when route segment changes. */
export function useGsapPageEnter(routeKey: string) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      gsap.fromTo(
        el,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
      );
    },
    { dependencies: [routeKey], scope: ref },
  );

  return ref;
}
