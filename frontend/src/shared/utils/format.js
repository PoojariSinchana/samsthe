const compact = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// 3154580 → ₹31.5L
export const rupeesCompact = (n) => `₹${compact.format(n || 0)}`;

// 3154580 → ₹31,54,580
export const rupeesFull = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;