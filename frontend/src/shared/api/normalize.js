export const pickList = (d, ...keys) =>
  (Array.isArray(d) ? d : keys.map((k) => d?.[k]).find(Array.isArray)) ?? [];

export const pickOne = (d, ...keys) =>
  keys.map((k) => d?.[k]).find((v) => v && typeof v === "object") ?? d;