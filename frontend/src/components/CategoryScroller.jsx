import { useNavigate } from "react-router-dom";

const categories = [
  { key: "dance", label: "Dancers" },
  { key: "singing", label: "Singers" },
  { key: "instrumentalist", label: "Instrumentalists" },
  { key: "comedy", label: "Comedians" },
  { key: "debate", label: "Debaters" },
  { key: "drama", label: "Actors" },
  { key: "model", label: "Models" },
  { key: "cultural", label: "Cultural Performers" },
  { key: "special", label: "Special Abilities" },
  { key: "stunt", label: "Stunt Performers" },
  { key: "nutrition", label: "Nutritionists" },
  { key: "design", label: "Artists & Designers" }
];

export default function CategoryScroller() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "12px 16px",
        overflowX: "auto",
        borderBottom: "1px solid #eee"
      }}
    >
      {categories.map((cat) => (
        <button
          key={cat.key}
          onClick={() => navigate(`/?category=${cat.key}`)}
          style={{
            whiteSpace: "nowrap",
            padding: "8px 14px",
            borderRadius: 20,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
            fontSize: 14
          }}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
