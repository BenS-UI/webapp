"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    try {
      const t = (localStorage.getItem("theme") as "light" | "dark") || "dark";
      setTheme(t);
      document.documentElement.setAttribute("data-theme", t);
    } catch {}
  }, []);

  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("theme", next); } catch {}
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <button onClick={flip} aria-label="Toggle theme" title="Toggle theme"
      style={{ position: "fixed", right: 16, bottom: 16, zIndex: 10 }}>
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}