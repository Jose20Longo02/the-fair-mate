"use client";

import { useEffect } from "react";

export default function ScrollToMyChallenges() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#my-challenges") return;
    const el = document.getElementById("my-challenges");
    if (!el) return;
    // Defer so layout is complete and smooth scroll can animate properly
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(t);
  }, []);

  return null;
}
