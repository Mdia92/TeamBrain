"use client";

import Link from "next/link";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/app/lib/utils";

type TbCardProps = {
  children: ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
  interactive?: boolean;
  stagger?: boolean;
};

export const TbCard = forwardRef<HTMLDivElement, TbCardProps>(function TbCard(
  { children, className, href, onClick, interactive, stagger },
  ref,
) {
  const classes = cn(
    "tb-card",
    (interactive || href || onClick) && "tb-card-interactive cursor-pointer",
    stagger && "gsap-stagger-item",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes} ref={ref as never}>
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(classes, "w-full text-left")} ref={ref as never}>
        {children}
      </button>
    );
  }

  return (
    <div ref={ref} className={classes}>
      {children}
    </div>
  );
});
