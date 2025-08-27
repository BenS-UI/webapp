import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="navbar" aria-label="Primary">
      <div className="nav-container">
        <Link href="/" className="logo" aria-label="Home">
          <img src="/images/B-logo-a.svg" alt="Ben Sandivar Logo" />
        </Link>
        <ul className="nav-links">
          <li><Link href="/">Home</Link></li>
          <li><Link href="/projects">Gallery</Link></li>
          <li><Link href="/projects">Work</Link></li>
          <li><Link href="/playground">Music</Link></li>
          <li><Link href="/about">About</Link></li>
          <li><Link href="/contact">Contact</Link></li>
          <li><Link href="/playground">Playground</Link></li>
          <li><Link href="/blog">Blog</Link></li>
        </ul>
      </div>
    </nav>
  );
}
