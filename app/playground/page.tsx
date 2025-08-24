// app/playground/page.tsx
export default function Playground() {
  return (
    <main>
      <iframe
        src="/buck-it-embed.html"
        title="Buck-It Playground"
        style={{ width: "100%", height: "80vh", border: 0, display: "block" }}
      />
    </main>
  );
}
