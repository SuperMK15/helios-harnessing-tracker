"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Cable, Check, ChevronDown, ClipboardCheck, Crosshair, FileImage, LayoutList,
  Pencil, Ruler, Search, X, Zap,
} from "lucide-react";
import { blankTracking, harnesses, systems, type Harness, type Tracking } from "../lib/harnesses";

const stages = [
  { key: "mechReady", label: "Mech ready", icon: Crosshair, color: "blue" },
  { key: "soldered", label: "Soldered", icon: Zap, color: "amber" },
  { key: "installed", label: "Installed", icon: Check, color: "green" },
] as const;

type Stage = (typeof stages)[number]["key"];
type Row = Tracking & { id: string };

function Metric({ label, count, total, icon, color }: {
  label: string; count: number; total?: number; icon: ReactNode; color: string;
}) {
  return <div className={"metric " + color}>
    <div className="metric-top"><span className="metric-icon">{icon}</span><span>{label}</span></div>
    <div className="metric-number">{count}{total !== undefined && <span> / {total}</span>}</div>
    {total === undefined
      ? <span className="metric-sub">Across {systems.length} systems</span>
      : <progress value={count} max={total} aria-label={label + " progress"} />}
  </div>;
}

export default function Tracker() {
  const [records, setRecords] = useState<Record<string, Tracking>>({});
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [view, setView] = useState<"register" | "diagram">("register");
  const [system, setSystem] = useState("All systems");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<"all" | Stage | "uninspected">("all");
  const [active, setActive] = useState<Harness | null>(null);
  const [saveNotice, setSaveNotice] = useState("");

  async function refresh() {
    try {
      const response = await fetch("/api/harnesses", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const rows: Row[] = await response.json();
      setRecords(Object.fromEntries(rows.map((row) => [row.id, row])));
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }

  useEffect(() => { void refresh(); }, []);

  const query = search.trim().toLowerCase();
  const visible = harnesses.filter((harness) => {
    const record = records[harness.id] ?? blankTracking;
    const matchesStage = stage === "all" || (stage === "uninspected" ? !record.inspectedBy : !record[stage]);
    return (system === "All systems" || harness.system === system) && matchesStage &&
      [harness.id, harness.name, harness.endpoints, harness.connector, record.solderedBy, record.inspectedBy]
        .some((text) => text.toLowerCase().includes(query));
  });

  return <>
    <header className="topbar">
      <div className="frame topbar-inner">
        <div className="brand">
          <span className="brand-symbol"><Cable size={22} strokeWidth={1.8} /></span>
          <span>HELIOS <span className="brand-mark">MK II</span><small>HYBRID VTOL</small></span>
        </div>
        <nav aria-label="Tracker views">
          <button className={view === "register" ? "nav-item selected" : "nav-item"} aria-current={view === "register" ? "page" : undefined} onClick={() => setView("register")}><LayoutList size={17} /> Tracker</button>
          <button className={view === "diagram" ? "nav-item selected" : "nav-item"} aria-current={view === "diagram" ? "page" : undefined} onClick={() => setView("diagram")}><FileImage size={17} /> Wiring diagram</button>
        </nav>
      </div>
    </header>

    <main className="frame">
      {view === "register" ? <>
        <div className="headline">
          <div>
            <h1>Harness tracker</h1>
            <p>Track wiring fabrication and installation for Helios Mark 2.</p>
          </div>
          <button className="button secondary diagram-button" onClick={() => setView("diagram")}><FileImage size={17} /> View diagram</button>
        </div>

        <section className="metrics" aria-label="Build progress">
          <Metric label="Total harnesses" count={harnesses.length} icon={<Cable size={18} />} color="cyan" />
          {stages.map(({ key, label, icon: Icon, color }) => <Metric
            key={key} label={label} count={Object.values(records).filter((record) => record[key]).length}
            total={harnesses.length} icon={<Icon size={18} />} color={color} />)}
        </section>

        <section className="register" aria-labelledby="register-title">
          <div className="register-head">
            <div>
              <h2 id="register-title">Harness register</h2>
              <p>{visible.length} of {harnesses.length} runs</p>
            </div>
            <div className="filters">
              <label className="search"><Search size={18} /><input aria-label="Search harnesses" placeholder="Search harnesses…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <label className="select"><select aria-label="Filter by incomplete stage" value={stage} onChange={(event) => setStage(event.target.value as typeof stage)}>
                <option value="all">All statuses</option>
                <option value="mechReady">Mech pending</option>
                <option value="soldered">Soldering pending</option>
                <option value="installed">Installation pending</option>
                <option value="uninspected">Inspection pending</option>
              </select><ChevronDown size={15} /></label>
            </div>
          </div>
          <div className="system-tabs" aria-label="Filter by system">
            {["All systems", ...systems].map((name) => <button key={name} className={system === name ? "system active" : "system"} aria-pressed={system === name} onClick={() => setSystem(name)}>{name}</button>)}
          </div>
          {loadState === "error" && <div className="load-message" role="alert">Saved records could not be loaded. <button className="button secondary" onClick={() => { setLoadState("loading"); void refresh(); }}>Retry</button></div>}
          {loadState === "loading" && <div className="load-message" role="status">Loading saved records…</div>}
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Harness runs">
            <table>
              <thead><tr>
                <th scope="col">Harness run</th><th scope="col">Length <span>(mm)</span></th>
                {stages.map(({ key, label }) => <th className="stage-column" key={key} scope="col">{label}</th>)}
                <th scope="col">Soldered by</th><th scope="col">Inspected by</th><th className="edit-head" scope="col"><span className="sr-only">Edit</span></th>
              </tr></thead>
              <tbody>
                {visible.map((harness) => {
                  const record = records[harness.id] ?? blankTracking;
                  return <tr key={harness.id}>
                    <th scope="row" className="run">
                      <div className="run-name"><span className="run-id">{harness.id}</span> {harness.name}</div>
                      <div className="run-route">{harness.endpoints}</div>
                    </th>
                    <td className="length">{record.length ?? <span className="missing">—</span>}</td>
                    {stages.map(({ key }) => <td key={key} className="stage-column">
                      <span className={record[key] ? "stage-check done" : "stage-check"} role="img" aria-label={record[key] ? "Complete" : "Pending"}>
                        {record[key] ? <Check size={15} strokeWidth={2.5} /> : <span aria-hidden="true">–</span>}
                      </span>
                    </td>)}
                    <td>{record.solderedBy || <span className="missing">—</span>}</td>
                    <td>{record.inspectedBy || <span className="missing">—</span>}</td>
                    <td className="edit-cell"><button className="icon-button" title="Edit harness" aria-label={"Edit " + harness.name} disabled={loadState !== "ready"} onClick={() => { setSaveNotice(""); setActive(harness); }}><Pencil size={16} /></button></td>
                  </tr>;
                })}
                {visible.length === 0 && <tr><td colSpan={8} className="empty">No harnesses match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </> : <>
        <div className="headline">
          <div><h1>Wiring diagram</h1><p>Helios Mark 2 harnessing schematic.</p></div>
          <a className="button secondary" href="/harness-diagram.png" target="_blank" rel="noreferrer"><FileImage size={17} /> Open full size</a>
        </div>
        <div className="diagram-panel"><img src="/harness-diagram.png" width="2048" height="1219" alt="Helios Mark 2 wiring diagram showing power, propulsion, Pixhawk avionics, sensors, and servo wiring." /></div>
      </>}
    </main>
    <div role="status" className={saveNotice ? "toast" : "sr-only"}>{saveNotice && <><Check size={17} />{saveNotice}</>}</div>
    {active && <EditHarness key={active.id} harness={active} record={records[active.id] ?? blankTracking}
      onClose={() => setActive(null)} onConflict={() => { void refresh(); }} onSave={(row) => {
        setRecords((previous) => ({ ...previous, [row.id]: row }));
        setActive(null);
        setSaveNotice(active.id + " saved");
        window.setTimeout(() => setSaveNotice((current) => current === active.id + " saved" ? "" : current), 3500);
      }} />}
  </>;
}

function EditHarness({ harness, record, onClose, onSave, onConflict }: {
  harness: Harness; record: Tracking; onClose: () => void; onSave: (row: Row) => void; onConflict: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(record);
  const [length, setLength] = useState(record.length?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);

  useEffect(() => { dialog.current?.showModal(); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/harnesses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, id: harness.id, length: length === "" ? null : Number(length) }),
      });
      if (response.status === 409) {
        setConflict(true);
        onConflict();
      }
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        const message = details && typeof details === "object" && "error" in details && typeof details.error === "string"
          ? details.error
          : "Could not save this harness. Please try again.";
        throw new Error(message);
      }
      onSave(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this harness.");
    } finally {
      setSaving(false);
    }
  }

  return <dialog ref={dialog} aria-labelledby="edit-title" onCancel={(event) => {
    event.preventDefault();
    if (!saving) onClose();
  }}>
    <form onSubmit={save}>
      <div className="dialog-header">
        <span className="run-id">{harness.id}</span>
        <button type="button" className="icon-button" aria-label="Close" disabled={saving} onClick={onClose}><X size={19} /></button>
        <h2 id="edit-title">{harness.name}</h2>
        <p>{harness.endpoints}</p>
        <p className="connector">{harness.connector}</p>
      </div>
      <div className="dialog-fields">
        <label className="field"><span><Ruler size={16} /> Length (mm)</span>
          <input type="number" min="0" step="any" value={length} onChange={(event) => {
            const input = event.currentTarget;
            input.setCustomValidity(input.value !== "" && input.valueAsNumber <= 0 ? "Enter a positive length." : "");
            setLength(input.value);
          }} placeholder="Enter measured length" />
        </label>
        <fieldset><legend>Build stages</legend>
          <div className="toggle-grid">{stages.map(({ key, label }) => <label className="toggle" key={key}>
            <input type="checkbox" checked={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })} /> {label}
          </label>)}</div>
        </fieldset>
        <div className="people-grid">
          <label className="field"><span><Zap size={15} /> Soldered by</span><input maxLength={100} value={draft.solderedBy} onChange={(event) => setDraft({ ...draft, solderedBy: event.target.value })} placeholder="Name" /></label>
          <label className="field"><span><ClipboardCheck size={16} /> Inspected by</span><input maxLength={100} value={draft.inspectedBy} onChange={(event) => setDraft({ ...draft, inspectedBy: event.target.value })} placeholder="Name" /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="dialog-footer">
        <button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button>
        <button className="button primary" disabled={saving || conflict} type="submit">{saving ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  </dialog>;
}
