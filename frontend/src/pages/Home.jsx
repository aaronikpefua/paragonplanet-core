import CategoryScroller from "../components/CategoryScroller";
import VideoGrid from "../components/VideoGrid";

export default function Home() {
  return (
    <div style={{ height: "100vh", overflow: "hidden" }}>
      
      {/* CATEGORY FILTER BAR */}
      <CategoryScroller />

      {/* VIDEO FEED */}
      <VideoGrid />

    </div>
  );
}