import { useState } from "react";
import api from "../api/axios";

export default function ImageUploadField({
  label,
  value,
  uploadUrl,
  formFieldName,
  onUploaded,
  shape = "circle",
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);

    const formData = new FormData();
    formData.append(formFieldName, file);

    try {
      const { data } = await api.post(uploadUrl, formData);
      onUploaded(data.url);
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = ""; // allow picking the same file again later
    }
  }

  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-sm";

  return (
    <div>
      <label className="block text-sm text-muted">{label}</label>
      <div className="mt-1 flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className={`h-14 w-14 border border-charcoal-lighter object-cover ${shapeClass}`} />
        ) : (
          <div className={`flex h-14 w-14 items-center justify-center border border-dashed border-charcoal-lighter text-xs text-muted ${shapeClass}`}>
            None
          </div>
        )}
        <label className="cursor-pointer rounded-sm border border-charcoal-lighter px-3 py-2 text-sm text-cream hover:border-saffron">
          {uploading ? "Uploading…" : "Choose from device"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
      {value && <p className="mt-1 text-xs text-muted">Not saved yet — click "Save changes" below.</p>}
      {error && <p className="mt-1 text-xs text-brick">{error}</p>}
    </div>
  );
}