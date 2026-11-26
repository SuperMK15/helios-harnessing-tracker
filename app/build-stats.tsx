import { useState } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { systems, type System, type Wire } from "../lib/harnesses";

type Stage = { key: "lengthFinal" | "soldered" | "mechanicalReady" | "installed"; label: string };
type Credit = { name: string; soldered: number; inspected: number; total: number };
const columns = [
  { key: "soldered", label: "Soldered" }, { key: "inspected", label: "Inspected" }, { key: "total", label: "Total" },
] as const;
type SortKey = (typeof columns)[number]["key"];

function contributors(wires: Wire[]) {
  const byName = new Map<string, Credit>();
  for (const wire of wires) {
    for (const role of ["soldered", "inspected"] as const) {
      const raw = role === "soldered" ? wire.solderedBy : wire.inspectedBy;
      const name = raw.trim().replace(/\s+/g, " ");
      if (!name || /^(?:[?—–-]+|n\/a|unknown)$/i.test(name)) continue;
      const key = name.toLowerCase();
      const row = byName.get(key) ?? { name, soldered: 0, inspected: 0, total: 0 };
      row[role]++;
      row.total++;
      byName.set(key, row);
    }
  }
  return [...byName.values()];
}

export function BuildStats({ wires, stages, colors, onGroup }: {
  wires: Wire[]; stages: readonly Stage[]; colors: Record<System,string>; onGroup: (name: System) => void;
}) {
  const [sort, setSort] = useState<SortKey>("total");
  const credits = contributors(wires).sort((a,b) => b[sort] - a[sort] || b.total - a.total || a.name.localeCompare(b.name));
  const counts = stages.map(s => wires.filter(w => w[s.key]).length);
  const checks = counts.reduce((sum, n) => sum + n, 0);
  const possible = wires.length * stages.length;
  const measured = wires.filter(w => w.length !== null);
  const meters = measured.reduce((sum,w) => sum + (w.length ?? 0), 0) / 1000;
  return <div className="build-stats">
    <div className="stat-summary">
      <div><span>Stage completion</span><strong>{possible ? Math.round(100 * checks / possible) + "%" : "—"}</strong><small>{checks} of {possible} stage checks</small></div>
      <div><span>Fully complete</span><strong>{wires.filter(w => stages.every(s => w[s.key])).length}<em> / {wires.length}</em></strong><small>Runs with all four stages checked</small></div>
      <div><span>Recorded length</span><strong>{measured.length ? meters.toLocaleString(undefined,{maximumFractionDigits:3}) : "—"}<em> m</em></strong><small>Across {measured.length} measured runs</small></div>
    </div>
    <div className="stats-grid">
      <section className="stat-panel"><h2>Progress by stage</h2>
        {stages.map(({key,label},i) => <div className="stage-meter" key={key}><span>{label}</span><b>{counts[i]} / {wires.length}</b>
          <progress aria-label={label} value={counts[i]} max={wires.length || 1}/></div>)}
      </section>
      <section className="stat-panel"><h2>Functional groups</h2><p>Completed stage checks per group</p>
        {systems.map(name => {
          const group = wires.filter(w => w.system === name);
          const done = stages.reduce((sum,s) => sum + group.filter(w => w[s.key]).length, 0);
          const max = group.length * stages.length;
          return <button className="group-meter" key={name} onClick={() => onGroup(name)}>
            <span>{name}</span><span className="group-track" aria-hidden="true"><i style={{width: (max ? 100 * done / max : 0) + "%", background: colors[name]}}/></span>
            <b>{done} / {max}</b><ArrowUpRight size={14}/></button>;
        })}
      </section>
      <section className="stat-panel credit-panel"><h2>Contributors</h2><p>One credit per named soldering or inspection entry.</p>
        {credits.length ? <table className="credits"><thead><tr><th scope="col">Contributor</th>
          {columns.map(c => <th key={c.key} scope="col" aria-sort={sort === c.key ? "descending" : "none"}><button onClick={() => setSort(c.key)}>{c.label}{sort === c.key && <ArrowDown size={12}/>}</button></th>)}
        </tr></thead><tbody>{credits.map(c => <tr key={c.name}><th scope="row">{c.name}</th><td>{c.soldered}</td><td>{c.inspected}</td><td><b>{c.total}</b></td></tr>)}</tbody></table> : <p>No contributors recorded yet.</p>}
      </section>
    </div>
  </div>;
}
