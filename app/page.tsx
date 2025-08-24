export default function Home() {
  return (
    <main>
      <section id="hero">
        {/* Copy your hero HTML here, converting class → className */}
        <canvas id="gl"></canvas>
        <div className="hero-content">
          <h1>Ben Sandivar</h1>
          <p>Transformative Ideas.</p>
          <a href="#projects" className="scroll-arrow">→ View My Work</a>
        </div>
      </section>
      {/* Keep other sections or add them later */}
    </main>
  );
}
