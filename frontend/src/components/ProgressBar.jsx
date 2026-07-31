export default function ProgressBar({ balance, target }) {
  const bal = Number(balance);
  const tgt = Number(target);
  const over = bal < 0;
  const ratio = tgt > 0 ? Math.min(Math.max(bal, 0) / tgt, 1) : 0;
  const pct = Math.round(ratio * 100);

  if (tgt <= 0 && !over) {
    return null;
  }

  return (
    <div>
      <div
        className={`progress${over ? ' progress--over' : ''}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={over ? 0 : pct}
      >
        {!over && (
          <div className="progress__fill" style={{ width: `${pct}%` }} />
        )}
      </div>
      {over && <div className="progress-meta">Over goal</div>}
    </div>
  );
}
