export default function SectionHeader({ kicker, title, detail, aside, plain = false }) {
  return (
    <div
      className={
        plain
          ? "flex flex-wrap items-end justify-between gap-3"
          : "flex flex-wrap items-end justify-between gap-3 rounded-lg border border-white/25 bg-[#f4f2eb]/72 px-4 py-3 backdrop-blur-sm"
      }
    >
      <div className="max-w-2xl">
        {kicker && <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-mist">{kicker}</p>}
        {title && <h2 className="font-display text-xl font-semibold tracking-tight text-ink">{title}</h2>}
        {detail && <p className="mt-1 text-sm leading-6 text-mist">{detail}</p>}
      </div>
      {aside}
    </div>
  );
}
