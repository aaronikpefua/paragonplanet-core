import "../styles/categories.css";

const categories = [
  "Dance",
  "Singing",
  "Instrumentalist",
  "Comedy",
  "Debate",
  "Drama",
  "Model",
  "Cultural",
  "Special Ability"
];

export default function CategoryBar() {
  return (
    <div className="pp-categories">
      {categories.map(cat => (
        <button key={cat}>{cat}</button>
      ))}
    </div>
  );
}
