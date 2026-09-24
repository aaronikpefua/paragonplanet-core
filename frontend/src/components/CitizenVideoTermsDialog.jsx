export default function CitizenVideoTermsDialog({ terms, onClose }) {
  if (!terms) return null;
  return (
    <div style={backdropStyle} role="presentation">
      <section style={dialogStyle} role="dialog" aria-modal="true" aria-label="Citizen Video Upload Terms and Conditions">
        <h2 style={{ marginTop: 0 }}>{terms.title || "Paragon Planet Citizen Video Upload Terms & Conditions"}</h2>
        <div style={bodyStyle}>{terms.body}</div>
        <button type="button" onClick={onClose} style={buttonStyle}>Close</button>
      </section>
    </div>
  );
}

const backdropStyle = { position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,.72)", display: "grid", placeItems: "center", padding: 16 };
const dialogStyle = { width: "min(760px, 100%)", maxHeight: "88vh", overflow: "auto", background: "#fff", color: "#111", borderRadius: 14, padding: 22, boxSizing: "border-box" };
const bodyStyle = { whiteSpace: "pre-wrap", lineHeight: 1.6 };
const buttonStyle = { marginTop: 18, padding: "10px 18px", border: 0, borderRadius: 8, background: "#111", color: "#fff", fontWeight: 700, cursor: "pointer" };
