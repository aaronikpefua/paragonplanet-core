export default function Menu({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 260,
        height: "100%",
        background: "#fff",
        borderLeft: "1px solid #ddd",
        padding: 20,
        zIndex: 1000,
      }}
    >
      <button onClick={onClose}>Close ✕</button>

      <ul style={{ listStyle: "none", padding: 0 }}>
        <li>🔥 Trending</li>
        <li>🎭 Categories</li>
        <li>🏆 Top Stars</li>
        <li>💰 Wallet</li>
        <li>⚙ Settings</li>
      </ul>
    </div>
  );
}
