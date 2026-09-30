import { useEffect, useId, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { api } from "../api";
import { GREETING, PROMPTS, composeReply, detectIntent } from "../assistant";
import { formatNumber } from "../format";
import { usePoll } from "../hooks";

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduce(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduce;
}

function TypedText({ text, active, onDone }) {
  const reduce = usePrefersReducedMotion();
  const [count, setCount] = useState(active && !reduce ? 0 : text.length);
  const finished = useRef(false);

  useEffect(() => {
    if (!active || reduce) {
      setCount(text.length);
      return undefined;
    }
    if (count >= text.length) return undefined;
    const step = text.length > 900 ? 8 : text.length > 420 ? 4 : 2;
    const timer = window.setTimeout(() => {
      setCount((value) => Math.min(text.length, value + step));
    }, 16);
    return () => window.clearTimeout(timer);
  }, [active, count, reduce, text]);

  useEffect(() => {
    if (!active || count < text.length || finished.current) return;
    finished.current = true;
    onDone?.();
  }, [active, count, onDone, text.length]);

  const done = count >= text.length;
  return (
    <>
      {text.slice(0, count)}
      {!done && <span className="assistant-caret" aria-hidden="true" />}
    </>
  );
}

// Center of the Gemini sparkle in the 1280×720 landscape film.
const FILM = { width: 1280, height: 720, markX: 1163, markY: 645, scale: 1.03 };
const LAUNCHER = { width: 132, height: 44 };

function filmMark(vw, vh) {
  const cover = Math.max(vw / FILM.width, vh / FILM.height);
  const x = (vw - FILM.width * cover) / 2 + FILM.markX * cover;
  const y = (vh - FILM.height * cover) / 2 + FILM.markY * cover;
  return {
    x: vw / 2 + (x - vw / 2) * FILM.scale,
    y: vh / 2 + (y - vh / 2) * FILM.scale,
  };
}

function useFilmMark() {
  const [anchor, setAnchor] = useState({ right: 16, bottom: 16 });

  useEffect(() => {
    function place() {
      const point = filmMark(window.innerWidth, window.innerHeight);
      const right = window.innerWidth - point.x - LAUNCHER.width / 2;
      const bottom = window.innerHeight - point.y - LAUNCHER.height / 2;
      setAnchor({
        right: Math.min(Math.max(8, right), window.innerWidth - LAUNCHER.width - 8),
        bottom: Math.min(Math.max(8, bottom), window.innerHeight - LAUNCHER.height - 8),
      });
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  return anchor;
}

function TypingDots() {
  return (
    <p className="assistant-msg assistant-msg-bot" aria-label="Reading the live feed">
      <span className="assistant-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </p>
  );
}

export default function EnergyAssistant() {
  const titleId = useId();
  const dash = usePoll(api.dashboard, 5000);
  const dataRef = useRef(dash.data);
  dataRef.current = dash.data;
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);
  const greeted = useRef(false);

  const anchor = useFilmMark();
  const kpis = dash.data?.kpis;
  const critical = kpis?.critical || 0;
  const typing = messages.some((message) => message.animate);

  useEffect(() => {
    if (!open || greeted.current) return;
    greeted.current = true;
    setMessages([{ id: "greet", role: "assistant", text: GREETING, animate: true }]);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const node = logRef.current;
    if (!open || !node) return undefined;
    node.scrollTop = node.scrollHeight;
    if (!typing && !busy) return undefined;
    const id = window.setInterval(() => {
      node.scrollTop = node.scrollHeight;
    }, 48);
    return () => window.clearInterval(id);
  }, [open, messages, busy, typing]);

  function settle(id) {
    setMessages((current) => current.map((message) => (message.id === id ? { ...message, animate: false } : message)));
  }

  async function send(text, intent) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const resolved = intent || detectIntent(trimmed);
    const replyId = `${Date.now()}`;
    setDraft("");
    setMessages((current) => [...current, { id: `${replyId}-user`, role: "user", text: trimmed }]);
    setBusy(true);
    try {
      const reply = await composeReply(resolved, dataRef.current);
      setMessages((current) => [...current, { id: replyId, role: "assistant", text: reply, animate: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="no-print pointer-events-none fixed z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col items-end gap-3"
      style={{ right: anchor.right, bottom: anchor.bottom }}
    >
      {open && (
        <section
          id="energy-assistant"
          role="dialog"
          aria-labelledby={titleId}
          className="assistant-drawer pointer-events-auto flex max-h-[min(34rem,calc(100dvh-7rem))] w-full flex-col"
        >
          <div className="assistant-scan" aria-hidden="true" />
          <header className="relative flex items-start justify-between gap-3 border-b border-bronze/30 px-4 py-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-sage">GreenGrid // live</p>
              <h2 id={titleId} className="mt-1 font-display text-lg font-semibold tracking-tight text-ivory">
                GREENY
              </h2>
              <p className="num mt-1 text-[11px] text-ivory/60">
                {kpis
                  ? `${formatNumber(kpis.live_load_kw)} kW demand · ${formatNumber(kpis.live_solar_kw)} kW solar · ${critical} critical`
                  : dash.error
                    ? "Feed offline"
                    : "Syncing portfolio"}
              </p>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-ivory/70 hover:text-ivory"
              onClick={() => setOpen(false)}
              aria-label="Close GREENY"
            >
              <X size={16} />
            </button>
          </header>

          <div ref={logRef} className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3" aria-live="polite">
            {messages.map((message) =>
              message.role === "user" ? (
                <p key={message.id} className="assistant-msg assistant-msg-user">
                  {message.text}
                </p>
              ) : (
                <p key={message.id} className="assistant-msg assistant-msg-bot">
                  {message.animate ? (
                    <>
                      <span className="sr-only">Responding</span>
                      <span aria-hidden="true">
                        <TypedText text={message.text} active onDone={() => settle(message.id)} />
                      </span>
                    </>
                  ) : (
                    message.text
                  )}
                </p>
              ),
            )}
            {busy && <TypingDots />}
          </div>

          <div className="relative border-t border-bronze/30 px-3 py-3">
            <div className="flex flex-wrap gap-1.5">
              {PROMPTS.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  disabled={busy}
                  onClick={() => send(prompt.label, prompt.id)}
                  className="assistant-chip"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
            <form
              className="mt-2 flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                send(draft);
              }}
            >
              <label className="sr-only" htmlFor="energy-assistant-input">
                Message GREENY
              </label>
              <input
                id="energy-assistant-input"
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask about demand, alerts, or the forecast"
                className="assistant-input"
                autoComplete="off"
              />
              <button type="submit" className="assistant-send" disabled={busy || !draft.trim()} aria-label="Send message">
                <Send size={15} />
              </button>
            </form>
          </div>
        </section>
      )}

      <button
        type="button"
        className={`assistant-bubble pointer-events-auto ${critical > 0 ? "is-hot" : ""}`}
        aria-expanded={open}
        aria-controls="energy-assistant"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="assistant-name" aria-hidden="true">GREENY</span>
        <span className="sr-only">{open ? "Close GREENY" : "Open GREENY"}</span>
        {!open && critical > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-crit px-1 text-[10px] font-semibold text-ivory">
            {critical}
          </span>
        )}
      </button>
    </div>
  );
}
