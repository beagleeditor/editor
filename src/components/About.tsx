export default function About({ onBack }: { onBack: () => void }) {
  return (
    <div className="welcome">
      <h1>BeagleEditor (Persepolis)</h1>

      <p style={{ color: "var(--muted)", textAlign: "center", maxWidth: 420 }}>
        A "beagleful" code editor.
      </p>

      <div>
        <button onClick={onBack}>Go Back</button>
      </div>

      <div style={{ marginTop: 20, color: "var(--muted)", fontSize: 13 }}>
        <div>Version: v26.4.2 "Aurora"</div>
        <div>Built with React + Monaco + Tauri</div>
      </div>
    </div>
  );
}
