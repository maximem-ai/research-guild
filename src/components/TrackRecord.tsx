export type TrackRow = {
  category_code: string; confirmed: number; verified_posted: number; removed: number;
  posted_rate: number | null; median_hours_to_decision: number | null; helpful_share: number | null;
};

/** Endorser track record. Posted rate is only shown from 3 confirmed endorsements (§13b.A). */
export function TrackRecord({ rows }: { rows: TrackRow[] }) {
  if (rows.length === 0) return <span className="badge">New endorser</span>;
  return (
    <ul className="space-y-1 text-xs">
      {rows.map((r) => (
        <li key={r.category_code}>
          <strong>{r.category_code}</strong>: {r.confirmed} confirmed endorsement{r.confirmed === 1 ? "" : "s"}
          {r.confirmed >= 3 && r.posted_rate != null ? ` · ${Math.round(r.posted_rate * 100)}% posted` : r.confirmed < 3 ? " · New endorser" : ""}
          {r.removed > 0 && ` · ${r.removed} removed`}
          {r.median_hours_to_decision != null && ` · median ${Math.round(r.median_hours_to_decision / 24 * 10) / 10} days to decision`}
          {r.helpful_share != null && ` · ${Math.round(r.helpful_share * 100)}% feedback rated helpful`}
        </li>
      ))}
    </ul>
  );
}
