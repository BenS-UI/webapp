"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function OverlayFrame({ open, children }: { open: boolean; children: React.ReactNode; }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("is-overlay-open");
    return () => document.body.classList.remove("is-overlay-open");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.back(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, router]);

  const onBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) router.back();
  };

  return (
    <div id="overlay-root" ref={rootRef} data-open={open ? "true" : "false"} role="dialog" aria-modal="true" tabIndex={-1} onMouseDown={onBackdrop}>
      <div className="overlay-inner">
        <button type="button" aria-label="Close" onClick={() => router.back()} style={{ position: "fixed", top: 12, right: 16 }}>✕</button>
        {children}
      </div>
    </div>
  );
}
