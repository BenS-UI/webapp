"use client";

import React, { useEffect } from "react";

export default function OverlayFrame({ children }: { children: React.ReactNode }) {
  const hasChildren = React.Children.count(children) > 0;

  useEffect(() => {
    document.body.classList.toggle("is-overlay-open", hasChildren);
    return () => document.body.classList.remove("is-overlay-open");
  }, [hasChildren]);

  if (!hasChildren) return null;

  return (
    <div id="overlay-root" data-open="true" role="dialog" aria-modal="true">
      <div className="overlay-inner">{children}</div>
    </div>
  );
}
