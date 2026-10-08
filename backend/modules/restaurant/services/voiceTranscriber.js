// Uses OpenAI's Whisper model, which auto-detects the spoken language —
// no "language" parameter needed, which is exactly what makes recording in
// any language work without the person picking one first.
async function transcribeAudio(buffer, mimetype, filename) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error("Voice input isn't configured — OPENAI_API_KEY is missing on the server");
    err.status = 503;
    throw err;
  }

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimetype || "audio/webm" }), filename || "recording.webm");
  form.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const err = new Error(`Voice transcription failed (${response.status})`);
    err.status = 502;
    err.detail = body;
    throw err;
  }

  const data = await response.json();
  return data.text || "";
}

module.exports = { transcribeAudio };