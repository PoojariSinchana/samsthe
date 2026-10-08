import { useEffect, useState } from "react";
import { useAuth } from "../../../shared/context/AuthContext";
import { getOutlets } from "../../../shared/api/outlets";
import { getTables, createTable, updateTable, updateTablePosition, updateTableStatus, deleteTable } from "../api/tables";
import FloorPlanCanvas from "../components/FloorPlanCanvas";

const STATUS_STYLE = {
  AVAILABLE: { label: "Free", dot: "🟢", text: "text-sage" },
  OCCUPIED: { label: "Busy", dot: "🔴", text: "text-brick" },
  RESERVED: { label: "Reserved", dot: "🟡", text: "text-saffron" },
  CLEANING: { label: "Cleaning", dot: "⚪", text: "text-muted" },
};

const SHAPES = [
  { value: "square", label: "Square" },
  { value: "round", label: "Round" },
  { value: "rectangle", label: "Rectangle" },
];

export default function TablesSection() {
  const { user } = useAuth();
  const canManage = ["owner", "manager"].includes(user.role);

  const [outlets, setOutlets] = useState([]);
  const [outlet, setOutlet] = useState("");
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("floor"); // "floor" | "list"
  const [editLayout, setEditLayout] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editTable, setEditTable] = useState(null);
  const [quickTable, setQuickTable] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await getOutlets();
        const activeOutlets = (res.outlets || []).filter((o) => o.isActive);
        setOutlets(activeOutlets);
        if (activeOutlets.length >= 1) setOutlet(activeOutlets[0]._id);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load outlets");
      }
    })();
  }, []);

  useEffect(() => {
    if (outlet) loadTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet]);

  async function loadTables() {
    setLoading(true);
    try {
      const res = await getTables({ outlet });
      setTables(res.tables.filter((t) => t.isActive));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load tables");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(table, status) {
    try {
      await updateTableStatus(table._id, status);
      loadTables();
      setQuickTable(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status");
    }
  }

  async function handlePositionChange(table, { x, y }) {
    // Optimistic update so the table doesn't snap back while the request is in flight.
    setTables((prev) => prev.map((t) => (t._id === table._id ? { ...t, position: { x, y } } : t)));
    try {
      await updateTablePosition(table._id, x, y);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save table position");
      loadTables(); // revert to server truth on failure
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl text-cream sm:text-2xl">Tables</h1>
        <div className="flex flex-wrap items-center gap-3">
          {outlets.length > 1 && (
            <select
              value={outlet}
              onChange={(e) => setOutlet(e.target.value)}
              className="rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-cream outline-none focus:border-saffron"
            >
              {outlets.map((o) => (
                <option key={o._id} value={o._id}>{o.name}</option>
              ))}
            </select>
          )}

          <div className="flex rounded-sm border border-charcoal-lighter">
            <button
              onClick={() => setView("floor")}
              className={`px-3 py-2 text-sm ${view === "floor" ? "bg-saffron text-charcoal" : "text-muted hover:text-cream"}`}
            >
              Floor
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-2 text-sm ${view === "list" ? "bg-saffron text-charcoal" : "text-muted hover:text-cream"}`}
            >
              List
            </button>
          </div>

          {canManage && view === "floor" && (
            <button
              onClick={() => setEditLayout((v) => !v)}
              className={`rounded-sm border px-4 py-2 text-sm font-medium transition-colors ${
                editLayout ? "border-saffron text-saffron" : "border-charcoal-lighter text-cream hover:border-saffron"
              }`}
            >
              {editLayout ? "Done arranging" : "Edit layout"}
            </button>
          )}

          {canManage && (
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark"
            >
              + Add Table
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}
      {editLayout && (
        <p className="text-sm text-muted">Drag any table to arrange the floor. Positions save automatically.</p>
      )}

      {loading ? (
        <p className="text-muted">Loading tables…</p>
      ) : tables.length === 0 ? (
        <p className="text-muted">No tables yet for this outlet.</p>
      ) : view === "floor" ? (
        <FloorPlanCanvas
          tables={tables}
          editMode={editLayout}
          onSelectTable={setQuickTable}
          onPositionChange={handlePositionChange}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tables.map((table) => {
            const style = STATUS_STYLE[table.status];
            return (
              <div key={table._id} className="receipt-card rounded-sm px-4 pb-6 pt-8 sm:px-5">
                <span className="receipt-notch left-6" />
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium text-cream">{table.name || table.tableNumber}</p>
                  {canManage && (
                    <button onClick={() => setEditTable(table)} className="shrink-0 text-xs text-muted hover:text-cream">
                      Edit
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted capitalize">{table.capacity} Seats · {table.shape}</p>
                {table.location && <p className="text-xs text-muted">{table.location}</p>}
                <p className={`mt-3 text-sm ${style.text}`}>
                  {style.dot} {style.label}
                  {table.status === "OCCUPIED" && table.currentOrder?.guestCount
                    ? ` · ${table.currentOrder.guestCount}/${table.capacity} seated`
                    : ""}
                </p>

                <select
                  value={table.status}
                  onChange={(e) => handleStatusChange(table, e.target.value)}
                  className="mt-3 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-2 py-1.5 text-sm text-cream outline-none focus:border-saffron"
                >
                  {Object.keys(STATUS_STYLE).map((s) => (
                    <option key={s} value={s}>{STATUS_STYLE[s].label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {quickTable && (
        <TableQuickPanel
          table={quickTable}
          canManage={canManage}
          onClose={() => setQuickTable(null)}
          onStatusChange={handleStatusChange}
          onEdit={() => { setEditTable(quickTable); setQuickTable(null); }}
        />
      )}

      {showAdd && (
        <TableFormModal outlet={outlet} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); loadTables(); }} />
      )}
      {editTable && (
        <TableFormModal
          outlet={outlet}
          existing={editTable}
          onClose={() => setEditTable(null)}
          onSaved={() => { setEditTable(null); loadTables(); }}
          onDeactivate={async () => { await deleteTable(editTable._id); setEditTable(null); loadTables(); }}
        />
      )}
    </div>
  );
}

// Click-a-table popover on the floor canvas (outside edit mode) — same
// status-change action as the list view's dropdown, just triggered from
// the canvas instead of a card.
function TableQuickPanel({ table, canManage, onClose, onStatusChange, onEdit }) {
  const style = STATUS_STYLE[table.status];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="receipt-card w-full max-w-xs rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate font-display text-lg text-cream">{table.name || table.tableNumber}</h2>
          <button onClick={onClose} className="shrink-0 text-muted hover:text-cream">✕</button>
        </div>
        <p className="mt-1 text-sm text-muted capitalize">{table.capacity} seats · {table.shape}</p>
        {table.location && <p className="text-xs text-muted">{table.location}</p>}
        <p className={`mt-3 text-sm ${style.text}`}>
          {style.dot} {style.label}
          {table.status === "OCCUPIED" && table.currentOrder?.guestCount
            ? ` · ${table.currentOrder.guestCount}/${table.capacity} seated`
            : ""}
        </p>

        <select
          value={table.status}
          onChange={(e) => onStatusChange(table, e.target.value)}
          className="mt-3 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-2 py-1.5 text-sm text-cream outline-none focus:border-saffron"
        >
          {Object.keys(STATUS_STYLE).map((s) => (
            <option key={s} value={s}>{STATUS_STYLE[s].label}</option>
          ))}
        </select>

        {canManage && (
          <button onClick={onEdit} className="mt-3 text-sm text-saffron hover:text-saffron-dark">
            Edit table
          </button>
        )}
      </div>
    </div>
  );
}

function TableFormModal({ outlet, existing, onClose, onSaved, onDeactivate }) {
  const [tableNumber, setTableNumber] = useState(existing?.tableNumber || "");
  const [name, setName] = useState(existing?.name || "");
  const [capacity, setCapacity] = useState(existing?.capacity || 4);
  const [shape, setShape] = useState(existing?.shape || "square");
  const [location, setLocation] = useState(existing?.location || "");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      if (existing) {
        await updateTable(existing._id, { tableNumber, name, capacity: Number(capacity), shape, location });
      } else {
        await createTable({ outlet, tableNumber, name, capacity: Number(capacity), shape, location });
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save table");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={handleSubmit} className="receipt-card max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">{existing ? "Edit Table" : "Add Table"}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-cream">✕</button>
        </div>

        {error && <p className="mt-2 text-sm text-brick">{error}</p>}

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-muted">Table Number</label>
            <input value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} required
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
          </div>
          <div>
            <label className="text-xs text-muted">Table Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Table 1"
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted">Capacity</label>
              <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} required
                className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
            </div>
            <div>
              <label className="text-xs text-muted">Shape</label>
              <select value={shape} onChange={(e) => setShape(e.target.value)}
                className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron">
                {SHAPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted">Location (record only — not drawn on the floor plan)</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Main Hall"
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {existing && onDeactivate && (
            <button type="button" onClick={onDeactivate} className="text-sm text-brick hover:underline">Deactivate</button>
          )}
          <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
            <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
            <button className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark">
              {existing ? "Save" : "Create Table"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}