import { useNavigate } from "react-router-dom";

export default function FloatingUploadButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/upload")}
      style={{
        position: "fixed",
        bottom: 80,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: "50%",
        background: "#ff004f",
        color: "#fff",
        fontSize: 30,
        border: "none",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        zIndex: 999
      }}
    >
      +
    </button>
  );
}