import { useEffect, useRef, useState } from "react";

export default function VideoHero({ motionRef }) {
  const videoRef = useRef(null);
  const [needsPlay, setNeedsPlay] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const play = video.play();
    if (play && typeof play.catch === "function") {
      play.catch(() => setNeedsPlay(true));
    }
  }, []);

  function start() {
    const video = videoRef.current;
    if (!video) return;
    video.play().then(() => setNeedsPlay(false)).catch(() => setNeedsPlay(true));
  }

  return (
    <div className="video-canvas pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#141a12]">
      <div ref={motionRef} className="video-motion h-full w-full will-change-transform">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/greengrid-poster.jpg"
          aria-hidden="true"
        >
          <source src="/greengrid-landscape.mp4" type="video/mp4" />
        </video>
      </div>
      {needsPlay && (
        <button
          type="button"
          onClick={start}
          className="pointer-events-auto absolute bottom-4 right-4 z-40 rounded-md border border-ivory/40 bg-[#141a12]/70 px-3 py-2 text-sm text-ivory"
        >
          Play film
        </button>
      )}
    </div>
  );
}
