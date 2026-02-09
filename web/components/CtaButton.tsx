"use client";

import Link from "next/link";
import { useRef, useState } from "react";

const SHINE_DURATION_MS = 1500;

type CtaButtonProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export default function CtaButton({
  href,
  children,
  className,
  style,
}: CtaButtonProps) {
  const [shineActive, setShineActive] = useState(false);
  const shineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMouseEnter() {
    if (shineTimeoutRef.current) return; // ya hay un barrido en curso, no reiniciar
    setShineActive(true);
    shineTimeoutRef.current = setTimeout(() => {
      setShineActive(false);
      shineTimeoutRef.current = null;
    }, SHINE_DURATION_MS);
  }

  const resolvedClassName = [className, shineActive && "btn-shine-active"]
    .filter(Boolean)
    .join(" ");

  return (
    <Link href={href} className={resolvedClassName} style={style} onMouseEnter={handleMouseEnter}>
      {children}
    </Link>
  );
}
