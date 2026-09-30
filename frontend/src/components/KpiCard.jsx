export default function KpiCard({ label, value, unit, detail }) {
  return (
    <article className="min-w-0 rounded-lg border border-line bg-surface px-4 py-4 shadow-card">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-mist">{label}</h3>
      <p className="num mt-3 text-[1.65rem] font-semibold leading-none tracking-tight text-ink">
        {value}
        {unit ? <span className="ml-1.5 text-sm font-medium text-mist">{unit}</span> : null}
      </p>
      {detail ? <p className="mt-2 text-xs leading-5 text-mist">{detail}</p> : null}
    </article>
  );
}
