import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { barcodeFormat } from "../utils/barcode";

export default function BarcodeImage({ value, height = 50 }) {
  const ref = useRef(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, { format: barcodeFormat(value), height, margin: 6, fontSize: 13, background: "#ffffff" });
      setErr("");
    } catch { setErr("This value can't be turned into a barcode"); }
  }, [value, height]);

  return (
    <>
      <svg ref={ref} className={`rounded-sm ${err ? "hidden" : ""}`} />
      {err && <p className="text-xs text-brick">{err}</p>}
    </>
  );
}