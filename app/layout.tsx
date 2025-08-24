import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Navbar from "../components/Navbar";
import ThemeToggle from "../components/ThemeToggle";
import OverlayFrame from "../components/OverlayFrame";
import MiniPlayerSlot from "../components/MiniPlayerSlot";

export const metadata: Metadata = {
  title: "Ben Sandivar",
  description: "Webapp shell",
  robots: { index: false, follow: true }
};

export default function RootLayout({
  children,
  overlay
}: {
  children: React.ReactNode;
  overlay?: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set saved theme early */}
        <link rel="stylesheet" href="/css/app.css" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme');
                if (t) document.documentElement.setAttribute('data-theme', t);
              } catch {}
            `
          }}
        />
        {/* (We’ll add your real CSS later) */}
      </head>
      <body>
        <Navbar />
        <ThemeToggle />

        {/* ElevenLabs, mounted once */}
        <elevenlabs-convai agent-id="agent_01k0a396khf3wr7ndjmt03pk33" />
        <Script
          src="https://unpkg.com/@elevenlabs/convai-widget-embed"
          strategy="afterInteractive"
        />

        {/* Mini-player slot (we'll wire later) */}
        <MiniPlayerSlot />

        {children}

        {/* Overlay outlet */}
        <OverlayFrame open={!!overlay}>{overlay}</OverlayFrame>

        {/* (We’ll load your legacy scripts later) */}
      </body>
    </html>
  );
}
