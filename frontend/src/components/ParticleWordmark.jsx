import { useEffect, useRef } from "react";

const WORD = "GreenGrid";
const FONT_FAMILY = '"Syne", sans-serif';
const WEIGHT = 600;
const INK = "rgba(246, 243, 234, 0.96)";
const LOOSE = "rgba(246, 243, 234, 0.62)";
const SHADOW = "rgba(18, 22, 16, 0.34)";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function viewport() {
  const view = window.visualViewport;
  return {
    width: Math.round(view?.width ?? window.innerWidth),
    height: Math.round(view?.height ?? window.innerHeight),
  };
}

function measureContext() {
  const canvas = document.createElement("canvas");
  return canvas.getContext("2d", { willReadFrequently: true });
}

function wordWidth(context, fontSize, tracking) {
  context.font = `${WEIGHT} ${fontSize}px ${FONT_FAMILY}`;
  let width = 0;
  for (const letter of WORD) width += context.measureText(letter).width;
  return width + tracking * fontSize * (WORD.length - 1);
}

function computeLayout(context, coarse) {
  const { width, height } = viewport();
  const small = width < 720;
  const tracking = small ? 0.02 : 0.045;
  const margin = Math.max(20, width * 0.07);
  const emWidth = wordWidth(context, 100, tracking) / 100;
  const preferred = clamp(0.06 * width + 40, 52, 156);
  const byWidth = (width - margin * 2) / emWidth;
  const byHeight = height * (small ? 0.13 : 0.16);
  const fontSize = Math.max(36, Math.floor(Math.min(preferred, byWidth, byHeight)));

  let count = clamp(Math.round(fontSize * fontSize * 0.12), 800, 2200);
  if (small) count = Math.min(count, 1200);
  if (coarse) count = Math.round(count * 0.7);

  const dprCap = small || coarse ? 1.5 : 2;
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  return { fontSize, tracking, count, dpr, small };
}

function sampleWord(context, { fontSize, tracking, count }) {
  context.font = `${WEIGHT} ${fontSize}px ${FONT_FAMILY}`;
  const metrics = context.measureText(WORD);
  const ascent = Math.ceil(metrics.actualBoundingBoxAscent || fontSize * 0.74);
  const descent = Math.ceil(metrics.actualBoundingBoxDescent || 0);
  const width = Math.ceil(wordWidth(context, fontSize, tracking));
  const height = ascent + descent;
  const inset = 2;

  const canvas = context.canvas;
  canvas.width = width + inset * 2;
  canvas.height = height + inset * 2;
  context.font = `${WEIGHT} ${fontSize}px ${FONT_FAMILY}`;
  context.fillStyle = "#fff";
  context.textBaseline = "alphabetic";
  let x = inset;
  for (const letter of WORD) {
    context.fillText(letter, x, inset + ascent);
    x += context.measureText(letter).width + tracking * fontSize;
  }

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let filled = 0;
  for (let index = 3; index < data.length; index += 4) if (data[index] > 128) filled += 1;

  const step = Math.max(1.4, Math.sqrt(filled / count));
  const points = [];
  for (let y = step / 2; y < canvas.height; y += step) {
    for (let px = step / 2; px < canvas.width; px += step) {
      const alpha = data[(Math.floor(y) * canvas.width + Math.floor(px)) * 4 + 3];
      if (alpha > 128) {
        points.push({
          x: px - inset - width / 2 + (Math.random() - 0.5) * step * 0.35,
          y: y - inset - height / 2 + (Math.random() - 0.5) * step * 0.35,
        });
      }
    }
  }
  points.sort((a, b) => a.x - b.x);
  return { points, width, height, step };
}

export default function ParticleWordmark({ onLayout }) {
  const canvasRef = useRef(null);
  const onLayoutRef = useRef(onLayout);
  onLayoutRef.current = onLayout;

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = canvas?.parentElement;
    const context = canvas?.getContext("2d", { alpha: true, desynchronized: true });
    const measure = measureContext();
    if (!canvas || !box || !context || !measure) return undefined;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const pointer = { x: 0, y: 0, active: false, touch: false, id: null };

    let particles = [];
    let layout = null;
    let shape = null;
    let pad = 0;
    let size = 1.5;
    let key = "";
    let frame = 0;
    let pending = 0;
    let disposed = false;
    let pointerRect = null;
    let steps = 0;

    function build(first) {
      const next = computeLayout(measure, coarse);
      const nextKey = `${next.fontSize}|${next.dpr}|${next.count}|${next.tracking}`;
      if (nextKey === key) return;
      key = nextKey;
      layout = next;
      shape = sampleWord(measure, next);
      pad = Math.round(next.fontSize * 0.6);
      size = clamp(shape.step * 0.8, 1.2, 2.8);

      box.style.width = `${shape.width}px`;
      box.style.height = `${shape.height}px`;
      const cssW = shape.width + pad * 2;
      const cssH = shape.height + pad * 2;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.style.left = `${-pad}px`;
      canvas.style.top = `${-pad}px`;
      canvas.width = Math.round(cssW * next.dpr);
      canvas.height = Math.round(cssH * next.dpr);
      canvas.dataset.particles = String(shape.points.length);
      onLayoutRef.current?.(next);

      const targets = shape.points;
      if (first || !particles.length) {
        particles = targets.map((point) => {
          const angle = Math.random() * Math.PI * 2;
          const reach = next.fontSize * (0.25 + Math.random() * 0.5);
          const delay = reduce ? 0 : 4 + ((point.x + shape.width / 2) / shape.width) * 36 + Math.random() * 8;
          return {
            x: reduce ? point.x : point.x + Math.cos(angle) * reach,
            y: reduce ? point.y : point.y + Math.sin(angle) * reach,
            vx: 0,
            vy: 0,
            tx: point.x,
            ty: point.y,
            delay,
          };
        });
      } else {
        const previous = particles;
        const used = new Set();
        particles = targets.map((point, index) => {
          const source = previous[Math.floor((index * previous.length) / targets.length)];
          const particle = used.has(source) ? { ...source } : source;
          used.add(source);
          particle.tx = point.x;
          particle.ty = point.y;
          particle.delay = 0;
          if (reduce) {
            particle.x = point.x;
            particle.y = point.y;
          }
          return particle;
        });
      }
      wake();
    }

    function draw() {
      const cssW = canvas.width / layout.dpr;
      const cssH = canvas.height / layout.dpr;
      context.setTransform(layout.dpr, 0, 0, layout.dpr, (cssW / 2) * layout.dpr, (cssH / 2) * layout.dpr);
      context.clearRect(-cssW / 2, -cssH / 2, cssW, cssH);
      const settled = new Path2D();
      const loose = new Path2D();
      const half = size / 2;
      const threshold = size * 1.5;
      for (const particle of particles) {
        const offset = Math.abs(particle.x - particle.tx) + Math.abs(particle.y - particle.ty);
        (offset < threshold ? settled : loose).rect(particle.x - half, particle.y - half, size, size);
      }
      context.fillStyle = SHADOW;
      context.translate(0, 0.9);
      context.fill(settled);
      context.translate(0, -0.9);
      context.fillStyle = INK;
      context.fill(settled);
      context.fillStyle = LOOSE;
      context.fill(loose);
    }

    function step() {
      frame = 0;
      if (disposed || !layout || document.hidden) return;

      let localX = 0;
      let localY = 0;
      let radius = 0;
      let force = 0;
      steps += 1;
      if (pointer.active && !reduce) {
        if (!pointerRect || steps % 8 === 0) pointerRect = canvas.getBoundingClientRect();
        const rect = pointerRect;
        localX = ((pointer.x - rect.left) / rect.width - 0.5) * (canvas.width / layout.dpr);
        localY = ((pointer.y - rect.top) / rect.height - 0.5) * (canvas.height / layout.dpr);
        radius = layout.fontSize * (pointer.touch ? 0.62 : 0.5);
        force = pointer.touch ? 1.35 : 2.1;
        const reachX = shape.width / 2 + radius;
        const reachY = shape.height / 2 + radius;
        if (Math.abs(localX) > reachX || Math.abs(localY) > reachY) force = 0;
      }

      const spring = layout.small ? 0.055 : 0.05;
      const damping = 0.83;
      const radiusSq = radius * radius;
      let moving = force > 0;

      for (const particle of particles) {
        if (particle.delay > 0) {
          particle.delay -= 1;
          moving = true;
          continue;
        }
        if (force > 0) {
          const dx = particle.x - localX;
          const dy = particle.y - localY;
          if (Math.abs(dx) < radius && Math.abs(dy) < radius) {
            const distSq = dx * dx + dy * dy;
            if (distSq < radiusSq) {
              const dist = Math.sqrt(distSq) || 0.001;
              const falloff = 1 - dist / radius;
              const push = force * falloff * falloff;
              particle.vx += (dx / dist) * push;
              particle.vy += (dy / dist) * push;
            }
          }
        }
        particle.vx = (particle.vx + (particle.tx - particle.x) * spring) * damping;
        particle.vy = (particle.vy + (particle.ty - particle.y) * spring) * damping;
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (
          !moving &&
          (Math.abs(particle.vx) + Math.abs(particle.vy) > 0.02 ||
            Math.abs(particle.x - particle.tx) + Math.abs(particle.y - particle.ty) > 0.08)
        ) {
          moving = true;
        }
      }

      if (!moving) {
        for (const particle of particles) {
          particle.x = particle.tx;
          particle.y = particle.ty;
          particle.vx = 0;
          particle.vy = 0;
        }
      }
      draw();
      if (moving) frame = requestAnimationFrame(step);
    }

    function wake() {
      if (!frame && !disposed) frame = requestAnimationFrame(step);
    }

    function schedule() {
      pointerRect = null;
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        build(false);
      });
    }

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        return;
      }
      wake();
    }

    function onPointerMove(event) {
      if (event.pointerType === "mouse") {
        pointer.touch = false;
        pointer.active = true;
      } else if (pointer.id !== event.pointerId) {
        return;
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      wake();
    }

    function onPointerDown(event) {
      if (event.pointerType === "mouse") return;
      pointer.id = event.pointerId;
      pointer.touch = true;
      pointer.active = true;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      wake();
    }

    function onPointerEnd(event) {
      if (event.pointerType !== "mouse" && event.pointerId !== pointer.id) return;
      pointer.active = false;
      pointer.id = null;
      wake();
    }

    function onLeaveWindow() {
      pointer.active = false;
      wake();
    }

    const root = document.documentElement;
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerEnd, { passive: true });
    window.addEventListener("pointercancel", onPointerEnd, { passive: true });
    root.addEventListener("pointerleave", onLeaveWindow);
    window.addEventListener("blur", onLeaveWindow);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    window.visualViewport?.addEventListener("resize", schedule);

    const fontReady = document.fonts?.load
      ? Promise.race([
          document.fonts.load(`${WEIGHT} 100px ${FONT_FAMILY}`),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ])
      : Promise.resolve();
    fontReady
      .catch(() => {})
      .then(() => {
        if (!disposed) build(true);
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(pending);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      root.removeEventListener("pointerleave", onLeaveWindow);
      window.removeEventListener("blur", onLeaveWindow);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, []);

  return <canvas ref={canvasRef} className="intro-particles" aria-hidden="true" />;
}
