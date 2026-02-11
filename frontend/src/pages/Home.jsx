import CategoryScroller from "../components/CategoryScroller";
import VideoGrid from "../components/VideoGrid";

export default function Home() {
  return (
    <>
      {/* CATEGORY FILTER BAR */}
      <CategoryScroller />

      {/* VIDEO GRID */}
      <main style={{ padding: 20 }}>
        <VideoGrid />
      </main>
    </>
  );
}
