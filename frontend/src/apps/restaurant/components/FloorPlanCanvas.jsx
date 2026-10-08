import { useRef, useState } from "react";

const CANVAS_W = 1000;
const CANVAS_H = 600;
const CHAIR_MARGIN = 24; // gap between table edge and chair
const CHAIR_R = 9;

const STATUS_TOKEN = {
  AVAILABLE: "sage",
  OCCUPIED: "brick",
  RESERVED: "saffron",
  CLEANING: "muted",
};

function tableDimensions(shape, capacity) {
  if (shape === "round") {
    const d = 60 + Math.max(0, capacity - 2) * 8;
    return { w: d, h: d };
  }
  if (shape === "square" && capacity <= 4) {
    return { w: 74, h: 74 };
  }
  const pairs = Math.ceil(capacity / 2);
  return { w: 60 + pairs * 38, h: 74 };
}

// Returns chair offsets relative to the table's center point.
function chairSlots(shape, capacity, w, h) {
  if (shape === "round") {
    const r = Math.max(w, h) / 2 + CHAIR_MARGIN;
    return Array.from({ length: capacity }, (_, i) => {
      const angle = (i / capacity) * 2 * Math.PI - Math.PI / 2;
      return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
    });
  }
  if (shape === "square" && capacity <= 4) {
    const slots = [
      { x: 0, y: -(h / 2 + CHAIR_MARGIN) },
      { x: w / 2 + CHAIR_MARGIN, y: 0 },
      { x: 0, y: h / 2 + CHAIR_MARGIN },
      { x: -(w / 2 + CHAIR_MARGIN), y: 0 },
    ];
    return slots.slice(0, capacity);
  }
  // rectangle (or square with >4 seats): split across top/bottom edges
  const topCount = Math.ceil(capacity / 2);
  const bottomCount = capacity - topCount;
  const slots = [];
  const topSpacing = w / (topCount + 1);
  for (let i = 1; i <= topCount; i++) slots.push({ x: -w / 2 + topSpacing * i, y: -(h / 2 + CHAIR_MARGIN) });
  const bottomSpacing = w / (bottomCount + 1);
  for (let i = 1; i <= bottomCount; i++) slots.push({ x: -w / 2 + bottomSpacing * i, y: h / 2 + CHAIR_MARGIN });
  return slots;
}

// Tables never manually placed (position {0,0}) get a fallback grid layout
// for display only — nothing is persisted until the manager actually drags
// one, at which point its real coordinates get saved.
function withFallbackPositions(tables) {
  let unplacedIndex = 0;
  return tables.map((t) => {
    if (t.position?.x || t.position?.y) return t;
    const col = unplacedIndex % 5;
    const row = Math.floor(unplacedIndex / 5);
    unplacedIndex++;
    return { ...t, position: { x: 110 + col * 170, y: 100 + row * 150 } };
  });
}

export default function FloorPlanCanvas({ tables, editMode, onSelectTable, onPositionChange }) {
  const svgRef = useRef(null);
  const [dragId, setDragId] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const positioned = withFallbackPositions(tables);

  function toSvgPoint(clientX, clientY) {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function handlePointerDown(e, table) {
    if (!editMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragId(table._id);
    setDragPos(toSvgPoint(e.clientX, e.clientY));
  }

  function handlePointerMove(e) {
    if (!dragId) return;
    setDragPos(toSvgPoint(e.clientX, e.clientY));
  }

  function handlePointerUp(table) {
    if (!dragId) return;
    const clampedX = Math.round(Math.min(Math.max(dragPos.x, 40), CANVAS_W - 40));
    const clampedY = Math.round(Math.min(Math.max(dragPos.y, 40), CANVAS_H - 40));
    setDragId(null);
    setDragPos(null);
    onPositionChange(table, { x: clampedX, y: clampedY });
  }

  return (
    <div className="receipt-card overflow-hidden rounded-sm">
      <span className="receipt-notch left-6" />
      {/* On phones the plan scrolls horizontally at a legible size instead of
          squishing every table/chair into an unreadable strip; from sm: up it
          fills the card width, and the full 600px height returns at lg:. */}
      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          className="h-[420px] w-[1000px] touch-none sm:h-[500px] sm:w-full lg:h-[600px]"
          onPointerMove={handlePointerMove}
        >
          {positioned.map((table) => {
            const { w, h } = tableDimensions(table.shape, table.capacity);
            const isDragging = dragId === table._id;
            const pos = isDragging ? dragPos : table.position;
            const chairs = chairSlots(table.shape, table.capacity, w, h);
            const token = STATUS_TOKEN[table.status] || "muted";
            const seated = table.status === "OCCUPIED" ? table.currentOrder?.guestCount : null;

            return (
              <g
                key={table._id}
                transform={`translate(${pos.x}, ${pos.y})`}
                className={editMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
                onPointerDown={(e) => handlePointerDown(e, table)}
                onPointerUp={() => handlePointerUp(table)}
                onClick={() => !isDragging && !editMode && onSelectTable(table)}
              >
                {chairs.map((c, i) => (
                  <text
                    key={i}
                    x={c.x}
                    y={c.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={CHAIR_R * 2.4}
                  >
                    🪑
                  </text>
                ))}

                {table.shape === "round" ? (
                  <circle
                    r={w / 2}
                    className={`fill-current text-charcoal-light stroke-current text-${token}`}
                    strokeWidth="3"
                  />
                ) : (
                  <rect
                    x={-w / 2}
                    y={-h / 2}
                    width={w}
                    height={h}
                    rx="6"
                    className={`fill-current text-charcoal-light stroke-current text-${token}`}
                    strokeWidth="3"
                  />
                )}

                <text textAnchor="middle" dy="-2" className="fill-current text-cream text-[13px] font-medium">
                  {table.name || table.tableNumber}
                </text>
                <text textAnchor="middle" dy="14" className={`fill-current text-${token} text-[11px]`}>
                  {seated ? `${seated}/${table.capacity} seated` : `${table.capacity} seats`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="border-t border-charcoal-lighter px-4 py-2 text-center text-xs text-muted sm:hidden">
        Scroll sideways to see the whole floor →
      </p>
    </div>
  );
}