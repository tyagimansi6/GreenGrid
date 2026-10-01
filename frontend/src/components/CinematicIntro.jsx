import { useCallback, useEffect, useRef, useState } from "react";
import { useDocumentTitle } from "../hooks";
import ParticleWordmark from "./ParticleWordmark";

const WORD = "GreenGrid";

function spring(state, target, stiffness, damping) {
  state.v += (target - state.value) * stiffness;
  state.v *= damping;
  state.value += state.v;
}

export default function CinematicIntro({ leaving, onEnter, motionRef }) {
  useDocumentTitle("");
  const wordRef = useRef(null);
  const subRef = useRef(null);
  const lightRef = useRef(null);
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const hoverRef = useRef(false);
  const leavingRef = useRef(leaving);
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  const copyRef = useRef(null);
  const wakeMotion = useRef(() => {});
  const [interactive, setInteractive] = useState(false);

  const applyLayout = useCallback(({ fontSize }) => {
    copyRef.current?.style.setProperty("--word-size", `${fontSize}px`);
  }, []);

  useEffect(() => {
    leavingRef.current = leaving;
    wakeMotion.current();
  }, [leaving]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointerFine = window.matchMedia("(pointer: fine)").matches;
    const enabled = pointerFine && !reduce;
    setInteractive(enabled);
    if (!enabled) return undefined;

    const word = { value: 0, v: 0 };
    const wordY = { value: 0, v: 0 };
    const light = { value: 0, v: 0 };
    const lightY = { value: 0, v: 0 };
    const film = { value: 0, v: 0 };
    const filmY = { value: 0, v: 0 };
    const cursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ring = { x: cursor.x, y: cursor.y };
    const scale = { value: 1, v: 0 };
    let frame = 0;

    function resting(state, target) {
      return Math.abs(state.value - target) < 0.0015 && Math.abs(state.v) < 0.0015;
    }

    function wake() {
      if (!frame) frame = requestAnimationFrame(tick);
    }

    wakeMotion.current = wake;

    function onMove(event) {
      pointerRef.current.x = event.clientX / window.innerWidth - 0.5;
      pointerRef.current.y = event.clientY / window.innerHeight - 0.5;
      pointerRef.current.active = true;
      cursor.x = event.clientX;
      cursor.y = event.clientY;
      wake();
    }

    function tick() {
      frame = 0;
      const targetX = leavingRef.current ? 0 : pointerRef.current.x;
      const targetY = leavingRef.current ? 0 : pointerRef.current.y;
      const scaleTarget = hoverRef.current ? 1.22 : 1;
      spring(word, targetX, 0.02, 0.88);
      spring(wordY, targetY, 0.02, 0.88);
      spring(light, targetX, 0.007, 0.92);
      spring(lightY, targetY, 0.007, 0.92);
      spring(film, targetX, 0.012, 0.9);
      spring(filmY, targetY, 0.012, 0.9);
      spring(scale, scaleTarget, 0.07, 0.82);

      ring.x += (cursor.x - ring.x) * 0.16;
      ring.y += (cursor.y - ring.y) * 0.16;

      if (wordRef.current) {
        wordRef.current.style.transform = `translate3d(${(-word.value * 7).toFixed(2)}px, ${(-wordY.value * 4.5).toFixed(2)}px, 0)`;
      }
      if (lightRef.current) {
        lightRef.current.style.transform = `translate3d(-50%, -50%, 0) translate3d(${(light.value * 5).toFixed(2)}px, ${(lightY.value * 3.5).toFixed(2)}px, 0)`;
      }
      if (motionRef?.current) {
        motionRef.current.style.transform = `scale(1.03) translate3d(${(film.value * 2.5).toFixed(2)}px, ${(filmY.value * 1.8).toFixed(2)}px, 0)`;
      }
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${cursor.x}px, ${cursor.y}px, 0) translate3d(-50%, -50%, 0)`;
        dotRef.current.style.opacity = pointerRef.current.active && !leavingRef.current ? "1" : "0";
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) translate3d(-50%, -50%, 0) scale(${scale.value.toFixed(3)})`;
        ringRef.current.style.opacity = pointerRef.current.active && !leavingRef.current ? "1" : "0";
      }
      const ringSettled = Math.abs(ring.x - cursor.x) < 0.4 && Math.abs(ring.y - cursor.y) < 0.4;
      const idle =
        resting(word, targetX) &&
        resting(wordY, targetY) &&
        resting(light, targetX) &&
        resting(lightY, targetY) &&
        resting(film, targetX) &&
        resting(filmY, targetY) &&
        resting(scale, scaleTarget) &&
        ringSettled;
      if (!idle) frame = requestAnimationFrame(tick);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      if (motionRef?.current) motionRef.current.style.transform = "";
    };
  }, [motionRef]);

  useEffect(() => {
    const video = document.querySelector("video");
    const canvas = document.createElement("canvas");
    canvas.width = 12;
    canvas.height = 6;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!video || !context) return undefined;

    function sample() {
      const node = subRef.current;
      if (!node || video.readyState < 2 || !video.videoWidth) return;
      const rect = node.getBoundingClientRect();
      const videoRect = video.getBoundingClientRect();
      const scale = Math.max(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight);
      const offsetX = (video.videoWidth * scale - videoRect.width) / 2;
      const offsetY = (video.videoHeight * scale - videoRect.height) / 2;
      const x = (rect.left + rect.width / 2 - videoRect.left + offsetX) / scale;
      const y = (rect.top + rect.height / 2 - videoRect.top + offsetY) / scale;
      const patchW = 90;
      const patchH = 28;
      const sx = Math.min(video.videoWidth - patchW, Math.max(0, x - patchW / 2));
      const sy = Math.min(video.videoHeight - patchH, Math.max(0, y - patchH / 2));
      context.drawImage(video, sx, sy, patchW, patchH, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let total = 0;
      const count = pixels.length / 4;
      for (let index = 0; index < pixels.length; index += 4) {
        total += 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
      }
      if (total === 0) return;
      const luminance = total / count / 255;
      const shade = Math.min(1, Math.max(0, (luminance - 0.3) / 0.4));
      const next = shade.toFixed(2);
      if (node.dataset.shade === next) return;
      node.dataset.shade = next;
      node.style.setProperty("--shade", next);
    }

    sample();
    const timer = window.setInterval(sample, 900);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={`intro-root${interactive ? " intro-fine" : ""}${leaving ? " is-leaving" : ""}`}>
      <div ref={lightRef} className="intro-light" aria-hidden="true" />
      <div ref={copyRef} className="intro-copy">
        <div ref={wordRef} className="intro-word-shift">
          <h1
            className="intro-word"
            onPointerEnter={() => {
              hoverRef.current = true;
              wakeMotion.current();
            }}
            onPointerLeave={() => {
              hoverRef.current = false;
              wakeMotion.current();
            }}
          >
            <span className="sr-only">{WORD}</span>
            <ParticleWordmark onLayout={applyLayout} />
          </h1>
        </div>
        <p className="intro-sub" ref={subRef}>
          <span className="intro-sub-veil" aria-hidden="true" />
          <span className="intro-sub-text">Smart Energy Management</span>
        </p>
        <button
          type="button"
          className="intro-explore"
          onClick={onEnter}
          onPointerEnter={() => {
            hoverRef.current = true;
            wakeMotion.current();
          }}
          onPointerLeave={() => {
            hoverRef.current = false;
            wakeMotion.current();
          }}
        >
          <span className="intro-explore-label">Explore</span>
          <span className="intro-arrow" aria-hidden="true">
            →
          </span>
          <span className="intro-explore-line" aria-hidden="true" />
        </button>
      </div>
      <div ref={dotRef} className="intro-cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="intro-cursor-ring" aria-hidden="true" />
    </div>
  );
}
