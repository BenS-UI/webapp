import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Navbar from "../components/Navbar";
import ThemeToggle from "../components/ThemeToggle";
import MiniPlayerSlot from "../components/MiniPlayerSlot";

export const metadata: Metadata = {
  title: "Ben Sandivar",
  description: "Webapp shell",
  robots: { index: false, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* set saved theme early */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme');
                if (t) document.documentElement.setAttribute('data-theme', t);
              } catch {}
            `,
          }}
        />
        {/* link global CSS */}
        <link rel="stylesheet" href="/css/base.css" />
        <link rel="stylesheet" href="/css/themes.css" />
        <link rel="stylesheet" href="/css/navbar.css" />
        <link rel="stylesheet" href="/css/app.css" />
      </head>
      <body>
        <Navbar />
        <ThemeToggle />
        {/* persistent ElevenLabs widget */}
        <elevenlabs-convai agent-id="agent_01k0a396khf3wr7ndjmt03pk33"></elevenlabs-convai>
        <Script src="https://unpkg.com/@elevenlabs/convai-widget-embed" strategy="afterInteractive" />
        <MiniPlayerSlot />
        {children}
      </body>
    </html>
  );
}
