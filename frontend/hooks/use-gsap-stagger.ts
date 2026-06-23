"use client";

import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import { gsap } from "@/lib/gsapConfig";

/** Stagger-fade list/grid children on mount or when deps change. */
export function useGsapStagger<T extends HTMLElement>(
  deps: unknown[] = [],
  selector = ".gsap-stagger-item",
) {
  const ref = useRef<T>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const items = root.querySelectorAll(selector);
      if (!items.length) return;
      gsap.from(items, {
        opacity: 0,
        y: 14,
        duration: 0.45,
        stagger: 0.06,
        ease: "power3.out",
        clearProps: "transform",
      });
    },
    { dependencies: deps, scope: ref },
  );

  return ref;
}
