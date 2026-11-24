"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Archive, Cable, Check, ChevronDown, CirclePlus, CircuitBoard, FileImage,
  LayoutList, ListFilter, LockKeyhole, LogOut, Pencil, RotateCcw, Search, X,
} from "lucide-react";
import {
  blankTracking, systems, wireLabel, type System, type Tracking, type Wire, type WireDetails,
} from "../lib/harnesses";

import { diagramRoutes, liftSignalDisconnects } from "../lib/diagram-routes";

const stages = [
  { key: "lengthFinal", label: "Length final" },
  { key: "soldered", label: "Soldered" },
  { key: "mechanicalReady", label: "Mech ready" },
  { key: "installed", label: "Installed" },
] as const;

const groupColors: Record<System, string> = {
  Power: "#7ab9ed",
  "Power Distribution": "#bfc7cd",
  Propulsion: "#ef938c",
  "Flight Controller": "#b4ce83",
  Servos: "#eab179",
  "RC + TELEM + VTX": "#e7ce78",
  "External Sensors": "#80c8a1",
};

const filterFields = [...stages, { key: "inspection", label: "Inspection" }] as const;
const filterOptions = [
  { value: "any", stageLabel: "Any", inspectionLabel: "Any" },
  { value: "checked", stageLabel: "Checked", inspectionLabel: "Recorded" },
  { value: "unchecked", stageLabel: "Unchecked", inspectionLabel: "Missing" },
] as const;
type StatusFilters = Record<(typeof filterFields)[number]["key"], (typeof filterOptions)[number]["value"]>;
const noStatusFilters: StatusFilters = { lengthFinal: "any", soldered: "any", mechanicalReady: "any", installed: "any", inspection: "any" };
type Editor = { wire: Wire } | { system: System; id: string };
type Mutation =
  | { action: "create"; id: string; system: System; details: WireDetails; tracking: Tracking }
  | { action: "edit"; id: string; revision: number; details?: Partial<WireDetails>; tracking: Tracking }
  | { action: "archive"; id: string; revision: number; archived: boolean };

async function saveWire(mutation: Mutation) {
  const response = await fetch("/api/harnesses", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mutation),
  });
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    const message = details && typeof details === "object" && "error" in details && typeof details.error === "string"
      ? details.error : "Could not save this wire. Please try again.";
    throw Object.assign(new Error(message), { status: response.status });
  }
  return (await response.json()) as Wire;
}

async function updateSession(method: "POST" | "DELETE", credentials?: { username: string; password: string }) {
  const response = await fetch("/api/editor-session", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials ?? {}),
  });
  const result = await response.json() as { editable: boolean; error?: string };
  if (!response.ok) throw new Error(result.error || "Could not update the editor session.");
  return result.editable;
}

export default function Tracker() {
  const [wires, setWires] = useState<Wire[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [view, setView] = useState<"register" | "diagram">("register");
  const [diagram, setDiagram] = useState<"functional" | "detailed">("functional");
  const [system, setSystem] = useState<System | null>(null);
  const [removed, setRemoved] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState(noStatusFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [notice, setNotice] = useState("");
  const [editable, setEditable] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [fullDiagram, setFullDiagram] = useState(false);
  const [targetWire, setTargetWire] = useState<string | null>(null);
  function revealWire(wire: Wire) {
    setSystem(wire.system);
    setRemoved(wire.archived);
    setSearch("");
    setStatusFilters(noStatusFilters);
    setTargetWire(wire.id);
    setView("register");
    setFullDiagram(false);
  }
  useEffect(() => {
    if (!targetWire || view !== "register") return;
    const row = Array.from(document.querySelectorAll<HTMLElement>("[data-wire]")).find(
      el => el.dataset.wire === targetWire && el.getClientRects().length > 0
    );
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: "center" });
    const timer = window.setTimeout(() => setTargetWire(null), 3000);
    return () => window.clearTimeout(timer);
  }, [targetWire, view]);

  async function refresh() {
    try {
      const response = await fetch("/api/harnesses", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setWires(await response.json());
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/editor-session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => { if (active && result && typeof result === "object" && "editable" in result && result.editable === true) setEditable(true); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  async function logOut() {
    setLoggingOut(true);
    try {
      await updateSession("DELETE");
      setEditable(false);
      setNotice("Logged out. You can still view the tracker.");
    } catch {
      setNotice("Could not log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  const activeWires = wires.filter((wire) => !wire.archived);
  const listed = wires.filter((wire) => wire.archived === removed);
  const query = search.trim().toLowerCase();
  const filterCount = Object.values(statusFilters).filter((value) => value !== "any").length;
  const matching = listed.filter((wire) =>
    (system === null || system === wire.system) &&
    (removed || filterFields.every(({ key }) => {
      const status = statusFilters[key];
      const checked = key === "inspection" ? Boolean(wire.inspectedBy) : wire[key];
      return status === "any" || checked === (status === "checked");
    })) &&
    [wire.id, wireLabel(wire.id), wire.name, wire.endpoints, wire.connector, wire.solderedBy, wire.inspectedBy]
      .some((value) => value.toLowerCase().includes(query)),
  );
  const sections = system ? [system] : systems.filter((name) => !removed && !query && filterCount === 0 ||
    matching.some((wire) => wire.system === name));

  function revealSection(name: System) {
    setSystem(name);
    setRemoved(false);
    setSearch("");
    setStatusFilters(noStatusFilters);
    setTargetWire(null);
    setFullDiagram(false);
    setView("register");
    requestAnimationFrame(() => {
      const heading = document.getElementById("register-title");
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: "start" });
    });
  }


  function addWire(section: System) {
    setNotice("");
    setEditor({ system: section, id: "wire-" + crypto.randomUUID() });
  }

  function applySave(wire: Wire, message: string, created: boolean) {
    setWires((previous) => previous.some(({ id }) => id === wire.id)
      ? previous.map((item) => item.id === wire.id ? wire : item)
      : [...previous, wire]);
    if (created) {
      setSystem(wire.system);
      setSearch("");
      setStatusFilters(noStatusFilters);
    }
    setEditor(null);
    setNotice(message);
  }

  return <>
    <header className="topbar">
      <div className="frame topbar-inner">
        <div className="brand">
          <span className="brand-symbol"><CircuitBoard size={22} strokeWidth={1.65} /></span>
          <div>HELIOS <span>MK II</span><small>HYBRID VTOL</small></div>
        </div>
        <div className="header-actions">
          <nav aria-label="Views">
            <button className={view === "register" ? "nav-item selected" : "nav-item"} aria-current={view === "register" ? "page" : undefined} onClick={() => setView("register")}><LayoutList size={16} /> Tracker</button>
            <button className={view === "diagram" ? "nav-item selected" : "nav-item"} aria-current={view === "diagram" ? "page" : undefined} onClick={() => setView("diagram")}><FileImage size={16} /> Diagrams</button>
          </nav>
          {editable
            ? <button className="button secondary editor-access" disabled={loggingOut} onClick={() => void logOut()}><LogOut size={15} /> Log out</button>
            : <button className="button secondary editor-access" onClick={() => setLoginOpen(true)}><LockKeyhole size={15} /> Log in to edit</button>}
        </div>
      </div>
    </header>

    <main className="frame">
      {view === "register" ? <>
        <div className="headline">
          <div>
            <h1>Harness tracker<span>.</span></h1>
            <p>Helios Mark 2 fabrication, installation, and inspection</p>
          </div>
          <button className="button secondary diagram-launch" onClick={() => { setDiagram("functional"); setView("diagram"); }}><FileImage size={16} /> View schematic</button>
        </div>
        <section className="metrics" aria-label="Build progress">
          <div className="metric"><span>Total wires</span><strong>{loadState === "ready" ? activeWires.length : "—"}</strong></div>
          {stages.map(({ key, label }) => {
            const count = activeWires.filter((wire) => wire[key]).length;
            return <div className="metric" key={key}>
              <span>{label}</span>
              <strong>{loadState === "ready" ? count : "—"} <small>/ {loadState === "ready" ? activeWires.length : "—"}</small></strong>
              <progress aria-label={label + " progress"} value={count} max={Math.max(1, activeWires.length)} />
            </div>;
          })}
        </section>

        <div className="workspace">
          <aside className="sidebar desktop-only" aria-label="Filter by functional group">
            <h2>Functional groups</h2>
            <div className="group-nav">
              <button className={!removed && system === null ? "current" : ""} aria-pressed={!removed && system === null} onClick={() => { setSystem(null); setRemoved(false); }}>
                <Cable size={16} /> <span>All groups</span><small>{activeWires.length}</small>
              </button>
              {systems.map((name) => <button key={name} className={!removed && system === name ? "current" : ""} aria-pressed={!removed && system === name} onClick={() => { setSystem(name); setRemoved(false); }}>
                <span className="terminal" style={{ color: groupColors[name] }} /><span>{name}</span>
                <small>{activeWires.filter((wire) => wire.system === name).length}</small>
              </button>)}
            </div>
            <div className="archive-nav group-nav">
              <button className={removed ? "current" : ""} aria-pressed={removed} onClick={() => { setSystem(null); setRemoved(true); setSearch(""); }}>
                <Archive size={15} /><span>Removed wires</span><small>{wires.length - activeWires.length}</small>
              </button>
            </div>
          </aside>

          <label className="mobile-group select">
            <span>Functional group</span>
            <select value={removed ? "removed" : system ?? "all"} onChange={(event) => {
              const value = event.target.value;
              setRemoved(value === "removed");
              setSystem(systems.find((name) => name === value) ?? null);
              if (value === "removed") setSearch("");
            }}>
              <option value="all">All groups</option>
              {systems.map((name) => <option key={name}>{name}</option>)}
              <option value="removed">Removed wires</option>
            </select>
            <ChevronDown size={16} />
          </label>

          <section className="register" aria-labelledby="register-title">
            <div className="register-head">
              <div><h2 id="register-title" tabIndex={-1}>{removed ? "Removed wires" : system ?? "Wire register"}</h2>
                <p>{loadState === "ready" ? matching.length + (matching.length === 1 ? " wire" : " wires") : " "}</p>
              </div>
              <div className="filters">
                <label className="search"><Search size={16} /><input aria-label="Search wires" placeholder="Search wires…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
                {!removed && <button className="button secondary" type="button" aria-haspopup="dialog"
                  aria-label={filterCount ? `Filter (${filterCount} active)` : undefined}
                  onClick={() => setFilterOpen(true)}>
                  <ListFilter size={16} /> Filter
                  {filterCount > 0 && <span className="filter-count" aria-hidden="true">{filterCount}</span>}
                </button>}
                {editable && system && !removed && <button className="button primary" disabled={loadState !== "ready"} onClick={() => addWire(system)}><CirclePlus size={16} /> Add wire</button>}
              </div>
            </div>
            {loadState === "error" && <div className="empty" role="alert">Saved wires could not be loaded. <button className="button secondary" onClick={() => { setLoadState("loading"); void refresh(); }}>Retry</button></div>}
            {loadState === "loading" && <div className="empty" role="status">Loading wires…</div>}
            {loadState === "ready" && <div className="sections">
              {sections.map((name) => {
                const rows = matching.filter((wire) => wire.system === name);
                return <section key={name} className="wire-section" aria-label={name + " wires"}>
                  {(!system || removed) && <div className="section-head">
                    <h3 style={{ color: groupColors[name] }}><span className="terminal" />{name}<small>{rows.length}</small></h3>
                    {editable && !removed && <button className="button section-add" aria-label={"Add wire to " + name} onClick={() => addWire(name)}><CirclePlus size={15} /> Add wire</button>}
                  </div>}
                  {rows.length ? <WireList targetWire={targetWire} rows={rows} editable={editable} onEdit={(wire) => { setNotice(""); setEditor({ wire }); }} /> :
                    <p className="empty">No wires {query || filterCount > 0 ? "match these filters." : "in this group."}</p>}
                </section>;
              })}
              {!sections.length && <p className="empty">{removed && !query ? "No removed wires." : "No wires match these filters."}</p>}
            </div>}
          </section>
        </div>
      </> : <>
        <div className="headline">
          <div><h1>Wiring diagrams<span>.</span></h1><p>Helios Mark 2 electrical architecture</p></div>
          <button className="button secondary" aria-pressed={fullDiagram} onClick={() => setFullDiagram(!fullDiagram)}><FileImage size={16} />{fullDiagram ? "Fit to view" : "Open full size"}</button>
        </div>
        <div className="diagram-tabs" aria-label="Select diagram">
          <button className="button secondary" aria-pressed={diagram === "functional"} onClick={() => setDiagram("functional")}>Functional overview</button>
          <button className="button secondary" aria-pressed={diagram === "detailed"} onClick={() => setDiagram("detailed")}>Detailed harnessing</button>
        </div>
        <div className="diagram-panel">
          {diagram === "detailed" ? <DetailedDiagram wires={wires} full={fullDiagram} onReveal={revealWire} /> :
            <FunctionalDiagram wires={activeWires} loadState={loadState} full={fullDiagram} onReveal={revealSection} />}

        </div>
      </>}
    </main>

    <div className={notice ? "toast" : "sr-only"} role="status">{notice && <><Check size={17} />{notice}<button className="icon-button" aria-label="Dismiss status" onClick={() => setNotice("")}><X size={16} /></button></>}</div>
    {filterOpen && <StatusFilterDialog initial={statusFilters} onClose={() => setFilterOpen(false)} onApply={(next) => {
      setStatusFilters(next);
      setFilterOpen(false);
    }} />}
    {loginOpen && <EditorLogin onClose={() => setLoginOpen(false)} onLogin={() => {
      setLoginOpen(false);
      setEditable(true);
      setNotice("Editing enabled");
      void refresh();
    }} />}
    {editor && <WireEditor key={"wire" in editor ? editor.wire.id : editor.id} editor={editor}
      onClose={() => setEditor(null)} onSaved={applySave} onConflict={() => { void refresh(); }}
      onExpired={() => { setEditor(null); setEditable(false); setLoginOpen(true); setNotice("Your editor session expired."); }} />}
  </>;
}

function StatusFilterDialog({ initial, onClose, onApply }: {
  initial: StatusFilters; onClose: () => void; onApply: (next: StatusFilters) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(initial);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    element?.querySelector("h2")?.focus();
    return () => { element?.close(); };
  }, []);

  return <dialog className="status-filter-dialog" ref={dialog} aria-labelledby="status-filter-title" onCancel={(event) => {
    event.preventDefault();
    onClose();
  }}>
    <form onSubmit={(event) => {
      event.preventDefault();
      onApply(draft);
    }}>
      <div className="dialog-header">
        <h2 id="status-filter-title" tabIndex={-1}>Filter wire statuses</h2>
        <button type="button" className="icon-button dialog-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        <p>Show wires that match every selected status.</p>
      </div>
      <div className="dialog-fields">
        {filterFields.map(({ key, label }) => <fieldset key={key}>
          <legend>{label}</legend>
          <div className="filter-options">
            {filterOptions.map(({ value, stageLabel, inspectionLabel }) => <label className="filter-option" key={value}>
              <input className="sr-only" type="radio" name={key} value={value} checked={draft[key] === value}
                onChange={() => setDraft({ ...draft, [key]: value })} />
              <span>{key === "inspection" ? inspectionLabel : stageLabel}</span>
            </label>)}
          </div>
        </fieldset>)}
      </div>
      <div className="dialog-footer">
        <button type="button" className="button secondary filter-reset" onClick={() => setDraft(noStatusFilters)}>Reset</button>
        <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="button primary">Apply filters</button>
      </div>
    </form>
  </dialog>;
}

// Bounds are in the functional diagram's native 2048 × 1204 coordinate system.
const functionalRegions: Record<System, [number, number, number, number, number][]> = {
  Propulsion: [[163, 65, 611, 656, 92]],
  Power: [[1420, 172, 595, 198, 30]],
  "Power Distribution": [[940, 31, 389, 260, 39], [901, 339, 199, 53, 0]],
  "Flight Controller": [
    [932, 477, 274, 397, 41], // Pixhawk body
    [956, 435, 112, 92, 0], [1082, 435, 92, 61, 0], // Servo rail and power
    [863, 492, 77, 168, 0], [863, 675, 77, 168, 0], // Left CAN and PWM
    [1188, 492, 76, 99, 0], [1188, 599, 76, 99, 0], [1188, 736, 76, 77, 0],
    [953, 843, 107, 77, 0], [1075, 843, 107, 77, 0], // UART ports
  ],
  Servos: [[31, 851, 825, 168, 25]],
  "RC + TELEM + VTX": [[884, 958, 460, 213, 32]],
  "External Sensors": [[1618, 462, 351, 688, 53]],
};

function FunctionalDiagram({ wires, full, loadState, onReveal }: {
  wires: Wire[]; full: boolean; loadState: "loading" | "error" | "ready"; onReveal: (name: System) => void;
}) {
  const [tip, setTip] = useState<{ name: System; x: number; y: number; touch?: boolean } | null>(null);
  const touch = useRef<{ name: System; open: boolean } | null>(null);
  const group = wires.filter(w => w.system === tip?.name);
  useEffect(() => {
    const dismiss = () => setTip(null);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, []);
  return <>
    <svg viewBox="0 0 2048 1204" className={"wire-map functional-map" + (full ? " native" : "")}
      aria-label="Functional overview. Select a group to open its wires." onKeyDown={e => { if (e.key === "Escape") setTip(null); }}>
      <image href="/functional-diagram.png" width="2048" height="1204" onPointerDown={() => setTip(null)} />
      {systems.map(name => <g key={name} className="group-hit" role="link" tabIndex={0} aria-label={name}
        aria-describedby={tip?.name === name ? "function-tip" : undefined} data-active={tip?.name === name}
        onPointerMove={e => { if (e.pointerType !== "touch") setTip({ name, x: e.clientX, y: e.clientY }); }}
        onPointerLeave={e => { if (e.pointerType !== "touch") setTip(null); }}
        onPointerDown={e => { touch.current = e.pointerType === "touch" ? { name, open: !!tip?.touch && tip.name === name } : null; }}
        onFocus={e => { const r = e.currentTarget.getBoundingClientRect(); setTip({ name, x: r.left + r.width / 2, y: r.top + r.height / 2 }); }}
        onBlur={() => setTip(null)}
        onClick={e => {
          const firstTap = touch.current?.name === name && !touch.current.open;
          touch.current = null;
          if (firstTap) setTip({ name, x: e.clientX, y: e.clientY, touch: true });
          else onReveal(name);
        }}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onReveal(name); } }}>
        {functionalRegions[name].map(([x,y,width,height,r]) => <rect key={`${x}-${y}`} x={x} y={y} width={width} height={height} rx={r} />)}
      </g>)}
    </svg>
    {tip && <div role="tooltip" id="function-tip" className="wire-tip" style={{
      left: Math.max(6, Math.min(window.innerWidth - 238, tip.x + 12)),
      top: tip.y > window.innerHeight - 175 ? Math.max(6, tip.y - 165) : tip.y + 12,
    }}>
      <strong>{tip.name}</strong>
      {loadState === "ready" ? stages.map(({key,label}) => <div key={key}><span>{label}</span>
        <b>{group.filter(w => w[key]).length} / {group.length}</b></div>) :
        <span>{loadState === "loading" ? "Loading wire counts…" : "Wire counts unavailable"}</span>}
      {tip.touch && <small>Tap the group again to open</small>}
    </div>}
  </>;
}

function DetailedDiagram({ wires, full, onReveal }: { wires: Wire[]; full: boolean; onReveal: (wire: Wire) => void }) {
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const selected = wires.find(w => w.id === hover?.id);
  useEffect(() => {
    const dismiss = () => setHover(null);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, []);
  return <>
    <svg className={full ? "wire-map native" : "wire-map"} viewBox="0 0 2048 1219" aria-label="Detailed harnessing. Select a wire to locate it in the register.">
      <image href="/harness-diagram.png" width="2048" height="1219" />
      {liftSignalDisconnects.map(({ x, y }) => <circle key={y} cx={x} cy={y} r={3}
        fill="#121212" stroke="#95c995" pointerEvents="none" aria-hidden="true" />)}
      {wires.map(wire => diagramRoutes[wire.id] && <path key={wire.id} d={diagramRoutes[wire.id]}
        className="wire-hit" data-active={wire.id === selected?.id} role="link" tabIndex={0}
        aria-label={wireLabel(wire.id) + " " + wire.name} aria-describedby={wire.id === selected?.id ? "wire-tip" : undefined}
        onPointerMove={e => { if (e.pointerType !== "touch") setHover({ id: wire.id, x: e.clientX, y: e.clientY }); }}
        onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)}
        onFocus={e => { const r = e.currentTarget.getBoundingClientRect(); setHover({ id: wire.id, x: (r.left+r.right)/2, y: (r.top+r.bottom)/2 }); }}
        onClick={() => onReveal(wire)} onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onReveal(wire); }
          if (e.key === "Escape") setHover(null);
        }} />)}
    </svg>
    {selected && hover && <div id="wire-tip" role="tooltip" className="wire-tip" style={{
      left: Math.max(6, Math.min(window.innerWidth - 238, hover.x + 14)),
      top: hover.y > window.innerHeight - 220 ? Math.max(6, hover.y - 200) : hover.y + 14
    }}>
      <small>{wireLabel(selected.id)}{selected.archived && " · Removed"}</small>
      <strong>{selected.name}</strong>
      {stages.map(({ key, label }) => <div key={key}><span>{label}</span><b className={selected[key] ? "complete" : ""}>{selected[key] ? "✓ Complete" : "Pending"}</b></div>)}
    </div>}
  </>;
}

type WireListProps = { targetWire: string | null; rows: Wire[]; editable: boolean; onEdit: (wire: Wire) => void };

function WireList(props: WireListProps) {
  return <>
    <WireTable {...props} />
    <ul className="mobile-wires" role="list">
      {props.rows.map((wire) => <li className="wire-card" key={wire.id} tabIndex={-1} data-wire={wire.id} data-located={props.targetWire === wire.id}>
        <div className="wire-card-header">
          <div>
            <span className="run-id">{wireLabel(wire.id)}</span>
            <h4>{wire.name}</h4>
            {wire.endpoints && <p className="run-route">{wire.endpoints}</p>}
          </div>
          {props.editable && <button className="icon-button" aria-label={(wire.archived ? "Review " : "Edit ") + wire.name} onClick={() => props.onEdit(wire)}>
            {wire.archived ? <Archive size={17} /> : <Pencil size={17} />}
          </button>}
        </div>
        <ul className="wire-card-stages" role="list">
          {stages.map(({ key, label }) => <li key={key}>
            <span className={wire[key] ? "stage-check done" : "stage-check"} aria-hidden="true">
              {wire[key] ? <Check size={13} strokeWidth={2.3} /> : "·"}
            </span>
            {label}<span className="sr-only">{wire[key] ? " complete" : " pending"}</span>
          </li>)}
        </ul>
        <dl className="wire-card-details">
          <div><dt>Length</dt><dd className="length">{wire.length === null ? "—" : wire.length + " mm"}</dd></div>
          <div><dt>Soldered by</dt><dd>{wire.solderedBy || "—"}</dd></div>
          <div><dt>Inspected by</dt><dd>{wire.inspectedBy || "—"}</dd></div>
        </dl>
      </li>)}
    </ul>
  </>;
}

function WireTable({ rows, editable, onEdit, targetWire }: WireListProps) {
  return <div className="table-scroll" tabIndex={0} role="region" aria-label="Wire rows">
    <table>
      <thead><tr>
        <th scope="col">Wire / route</th><th scope="col">Length <span>mm</span></th>
        {stages.map(({ key, label }) => <th className="stage-cell" key={key} scope="col">{label}</th>)}
        <th scope="col">Soldered by</th><th scope="col">Inspected by</th>{editable && <th scope="col" className="edit-head"><span className="sr-only">Open wire</span></th>}
      </tr></thead>
      <tbody>{rows.map((wire) => <tr key={wire.id} tabIndex={-1} data-wire={wire.id} data-located={targetWire === wire.id}>
        <th scope="row" className="run">
          <div className="run-name"><span className="run-id">{wireLabel(wire.id)}</span><span>{wire.name}</span></div>
          {wire.endpoints && <div className="run-route">{wire.endpoints}</div>}
        </th>
        <td className="length">{wire.length ?? <span className="muted">—</span>}</td>
        {stages.map(({ key }) => <td className="stage-cell" key={key}>
          <span className={wire[key] ? "stage-check done" : "stage-check"} role="img" aria-label={wire[key] ? "Complete" : "Pending"}>
            {wire[key] ? <Check size={14} strokeWidth={2.3} /> : <span aria-hidden="true">·</span>}
          </span>
        </td>)}
        <td>{wire.solderedBy || <span className="muted">—</span>}</td>
        <td>{wire.inspectedBy || <span className="muted">—</span>}</td>
        {editable && <td className="edit-cell"><button className="icon-button" aria-label={(wire.archived ? "Review " : "Edit ") + wire.name} onClick={() => onEdit(wire)}>
          {wire.archived ? <Archive size={15} /> : <Pencil size={15} />}
        </button></td>}
      </tr>)}</tbody>
    </table>
  </div>;
}

function WireEditor({ editor, onClose, onSaved, onConflict, onExpired }: {
  editor: Editor; onClose: () => void; onSaved: (wire: Wire, message: string, created: boolean) => void; onConflict: () => void; onExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const original = "wire" in editor ? editor.wire : null;
  const section = "wire" in editor ? editor.wire.system : editor.system;
  const [details, setDetails] = useState<WireDetails>({
    name: original?.name ?? "", endpoints: original?.endpoints ?? "", connector: original?.connector ?? "",
  });
  const [tracking, setTracking] = useState<Tracking>({
    length: original?.length ?? null,
    lengthFinal: original?.lengthFinal ?? false,
    mechanicalReady: original?.mechanicalReady ?? false,
    soldered: original?.soldered ?? false,
    installed: original?.installed ?? false,
    solderedBy: original?.solderedBy ?? "",
    inspectedBy: original?.inspectedBy ?? "",
    revision: original?.revision ?? blankTracking.revision,
  });
  const [length, setLength] = useState(original?.length?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);

  async function submit(mutation: Mutation, message: string) {
    setSaving(true);
    setError("");
    try {
      onSaved(await saveWire(mutation), message, mutation.action === "create");
    } catch (err) {
      if (err instanceof Error && "status" in err) {
        if (err.status === 401) {
          onExpired();
          return;
        }
        if (err.status === 409) {
          setConflict(true);
          onConflict();
        }
      }
      setError(err instanceof Error ? err.message : "Could not save this wire.");
    } finally {
      setSaving(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = { ...tracking, length: length === "" ? null : Number(length) };
    if ("wire" in editor) {
      const { wire } = editor;
      const changedDetails: Partial<WireDetails> = {};
      for (const field of ["name", "endpoints", "connector"] as const) {
        if (details[field].trim() !== wire[field]) changedDetails[field] = details[field].trim();
      }
      void submit({
        action: "edit", id: wire.id, revision: wire.revision,
        details: changedDetails, tracking: values,
      }, "Wire updated");
    } else {
      void submit({ action: "create", id: editor.id, system: editor.system, details, tracking: values }, "Wire added");
    }
  }

  function setArchived(archived: boolean) {
    if (!original) return;
    void submit({ action: "archive", id: original.id, revision: original.revision, archived }, archived ? "Wire moved to Removed wires" : "Wire restored");
  }

  return <dialog ref={dialog} aria-labelledby="wire-title" onCancel={(event) => {
    event.preventDefault();
    if (!saving) onClose();
  }}>
    <form onSubmit={save}>
      <div className="dialog-header">
        <div className="dialog-kicker"><span className="terminal" style={{ color: groupColors[section] }} />{section}{original && <span className="run-id">{wireLabel(original.id)}</span>}</div>
        <h2 id="wire-title">{original?.name ?? "Add wire"}</h2>
        <button type="button" className="icon-button dialog-close" aria-label="Close" disabled={saving} onClick={onClose}><X size={18} /></button>
        {original?.archived && <p>{[original.endpoints, original.connector].filter(Boolean).join(" · ")}</p>}
      </div>
      <div className="dialog-fields">
        {confirmRemove ? <p className="remove-message">Remove this wire from {section}? Its tracking details are kept in Removed wires, where you can restore it.</p> : <>
          {original?.archived && <p className="remove-message">Restore this wire to return it to {section}.</p>}
          <fieldset className="edit-fields" disabled={saving || conflict || original?.archived}>
            {!original?.archived && <>
              <label className="field">Wire name<input autoFocus={!original} required maxLength={120} value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} /></label>
              <label className="field">Route / description <span className="optional">optional</span><input maxLength={200} placeholder="Source to destination" value={details.endpoints} onChange={(event) => setDetails({ ...details, endpoints: event.target.value })} /></label>
              <label className="field">Connector or wire spec <span className="optional">optional</span><input maxLength={120} value={details.connector} onChange={(event) => setDetails({ ...details, connector: event.target.value })} /></label>
            </>}
            <label className="field">Length (mm)
              <input type="number" min="0" step="any" value={length} onChange={(event) => {
                const input = event.currentTarget;
                input.setCustomValidity(input.value !== "" && input.valueAsNumber <= 0 ? "Enter a positive length." : "");
                setLength(input.value);
              }} placeholder="Measured length" />
            </label>
            <fieldset><legend>Build stages</legend><div className="toggle-grid">
              {stages.map(({ key, label }) => <label className="toggle" key={key}>
                <input type="checkbox" checked={tracking[key]} onChange={(event) => setTracking({ ...tracking, [key]: event.target.checked })} />{label}
              </label>)}
            </div></fieldset>
            <div className="people-grid">
              <label className="field">Soldered by<input maxLength={100} value={tracking.solderedBy} onChange={(event) => setTracking({ ...tracking, solderedBy: event.target.value })} placeholder="Name" /></label>
              <label className="field">Inspected by<input maxLength={100} value={tracking.inspectedBy} onChange={(event) => setTracking({ ...tracking, inspectedBy: event.target.value })} placeholder="Name" /></label>
            </div>
          </fieldset>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="dialog-footer">
        {original && !original.archived && !confirmRemove && <button type="button" className="button remove-link" disabled={saving || conflict} onClick={() => { setError(""); setConfirmRemove(true); }}><Archive size={15} /> Remove wire</button>}
        {confirmRemove ? <>
          <button type="button" className="button secondary" disabled={saving} onClick={() => { setError(""); setConfirmRemove(false); }}>Go back</button>
          <button type="button" className="button danger" disabled={saving || conflict} onClick={() => setArchived(true)}>{saving ? "Removing…" : "Confirm removal"}</button>
        </> : <>
          <button type="button" className="button secondary" disabled={saving} onClick={onClose}>{original?.archived ? "Close" : "Cancel"}</button>
          {original?.archived
            ? <button type="button" className="button primary" disabled={saving || conflict} onClick={() => setArchived(false)}><RotateCcw size={15} /> Restore wire</button>
            : <button className="button primary" disabled={saving || conflict} type="submit">{saving ? "Saving…" : original ? "Save changes" : "Add wire"}</button>}
        </>}
      </div>
    </form>
  </dialog>;
}

function EditorLogin({ onClose, onLogin }: { onClose: () => void; onLogin: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await updateSession("POST", {
        username: String(form.get("username") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      onLogin();
    } catch (err) {
      setError(err instanceof Error && !(err instanceof SyntaxError) ? err.message : "Could not log in. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <dialog className="login-dialog" ref={dialog} aria-labelledby="login-title" onCancel={(event) => {
    event.preventDefault();
    if (!pending) onClose();
  }}>
    <form onSubmit={(event) => void login(event)}>
      <div className="dialog-header">
        <h2 id="login-title">Log in to edit</h2>
        <button type="button" className="icon-button dialog-close" aria-label="Close" disabled={pending} onClick={onClose}><X size={18} /></button>
        <p>Enter the WARG editor credentials to make changes.</p>
      </div>
      <div className="dialog-fields">
        <label className="field">Username<input name="username" autoComplete="username" autoFocus required maxLength={80} /></label>
        <label className="field">Password<input type="password" name="password" autoComplete="current-password" required maxLength={256} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="dialog-footer">
        <button type="button" className="button secondary" disabled={pending} onClick={onClose}>Cancel</button>
        <button className="button primary" type="submit" disabled={pending}>{pending ? "Logging in…" : "Log in"}</button>
      </div>
    </form>
  </dialog>;
}
