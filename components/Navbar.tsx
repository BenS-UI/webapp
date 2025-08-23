"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function Navbar() {
  const navRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const setH = () => document.documentElement.style.setProperty("--nav-height", nav.offsetHeight + "px");
    setH();
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    addEventListener("resize", setH);
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      removeEventListener("resize", setH);
      removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <nav ref={navRef} className="navbar" role="navigation" aria-label="Primary">
      <div className="nav-container">
        <Link href="/#hero" className="logo" aria-label="Ben Sandivar — Home">Ben</Link>
        <button className="more-btn" aria-expanded={open} onClick={() => setOpen(v => !v)} aria-label="Toggle Menu">☰</button>
        <ul className="nav-links" data-open={open ? "true" : "false"}>
          <li><Link href="/#hero">Home</Link></li>
          <li><Link href="/#music">Music</Link></li>
          <li><Link href="/playground">Playground</Link></li>
          <li><Link href="/blog">Blog</Link></li>
        </ul>
      </div>
    </nav>
  );
}