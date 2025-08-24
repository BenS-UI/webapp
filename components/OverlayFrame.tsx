"use client";

import { useEffect } from "react";

export default function OverlayFrame({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (open) {
      document.body.classList.add("is-overlay-open");
    } else {
      document.body.classList.remove("is-overlay-open");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div id="overlay-root" data-open={open}>
      <div className="overlay-inner">
        {children}
      </div>
    </div>
  );
}
