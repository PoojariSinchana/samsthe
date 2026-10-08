export default function StatCard({ label, value, accent = "saffron", change, changeLabel = "vs yesterday" }) {
  const accentClass = accent === "sage" ? "text-sage" : accent === "brick" ? "text-brick" : "text-saffron";
  const hasChange = typeof change === "number" && !Number.isNaN(change);
  const changePositive = change >= 0;

  return (
    <div className="receipt-card min-w-0 rounded-sm px-4 pb-5 pt-7 sm:px-5">
      <span className="receipt-notch left-6" />
      <p className="truncate text-xs text-muted sm:text-sm">{label}</p>
      <p
        title={String(value)}
        className={`mt-2 whitespace-nowrap font-display font-semibold leading-tight tabular-nums ${accentClass}`}
        style={{ fontSize: "clamp(1.05rem, 0.7rem + 1.1vw, 1.75rem)" }}
      >
        {value}
      </p>
      {hasChange && (
        <p className={`mt-1 text-xs ${changePositive ? "text-sage" : "text-brick"}`}>
          {changePositive ? "▲" : "▼"} {Math.abs(change)}% {changeLabel}
        </p>
      )}
    </div>
  );
}