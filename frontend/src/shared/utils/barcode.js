import JsBarcode from "jsbarcode";

export function ean13CheckDigit(d12) {
  const sum = d12.split("").reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

// Prefixes 20–29 are reserved by GS1 for in-store use, so they never clash with real products.
export function generateEan13(prefix = "200") {
  let body = prefix;
  while (body.length < 12) body += Math.floor(Math.random() * 10);
  return body + ean13CheckDigit(body);
}

// EAN13 only if it's 13 digits with a valid check digit; otherwise CODE128 (accepts any text/SKU).
export const barcodeFormat = (v = "") =>
  /^\d{13}$/.test(v) && ean13CheckDigit(v.slice(0, 12)) === v[12] ? "EAN13" : "CODE128";

function svgFor(value, opts = {}) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, value, { format: barcodeFormat(value), height: 50, margin: 4, fontSize: 13, ...opts });
  return svg.outerHTML;
}

// items: [{ value, name, variant, price, copies }]
export function printBarcodeLabels(items) {
  const labels = items.flatMap((it) =>
    Array.from({ length: it.copies || 1 }, () => `
      <div class="label">
        <div class="name">${esc(it.name || "")}${it.variant ? ` — ${esc(it.variant)}` : ""}</div>
        ${svgFor(it.value)}
        ${it.price != null ? `<div class="price">₹${it.price}</div>` : ""}
      </div>`)
  ).join("");
  const w = window.open("", "_blank", "width=700,height=800");
  if (!w) return;
  w.document.write(`<html><head><title>Labels</title><style>
    body{font-family:Arial,sans-serif;margin:8px}
    .sheet{display:flex;flex-wrap:wrap;gap:6px}
    .label{width:50mm;border:1px dashed #bbb;padding:4px;text-align:center;page-break-inside:avoid}
    .name{font-size:10px;font-weight:bold} .price{font-size:12px;font-weight:bold}
    svg{max-width:100%;height:auto}
  </style></head><body><div class="sheet">${labels}</div></body></html>`);
  w.document.close(); w.focus(); w.print();
}

export function downloadBarcodePng(svgEl, filename = "barcode.png") {
  const xml = new XMLSerializer().serializeToString(svgEl);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = img.width * 2; c.height = img.height * 2;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png"); a.download = filename; a.click();
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));