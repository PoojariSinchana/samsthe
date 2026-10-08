const { ENTRY_TYPES, CATEGORIES_BY_TYPE, PAYMENT_METHODS } = require("../../../shared/models/Entry")

const SYSTEM_PROMPT = `You classify a single free-text restaurant business transaction into a structured entry.
The input may be written or spoken in ANY language (English, Hindi, Kannada, Tamil, a mix of languages, etc.) — understand it correctly regardless of language, and always respond with English JSON.

Respond with ONLY a JSON object, no prose, no markdown fences, matching exactly:
{
  "entryType": one of ${JSON.stringify(ENTRY_TYPES)},
  "category": a string appropriate for that entryType (see allowed categories below),
  "description": short description in English (2-6 words),
  "amount": number (the rupee amount, no currency symbol),
  "quantity": number or null,
  "unit": string or null (e.g. "kg", "l", "pcs"),
  "supplierName": string or "" if not mentioned,
  "paymentMethod": one of ${JSON.stringify(PAYMENT_METHODS)} or null if not stated,
  "confidence": number between 0 and 1
}

Allowed categories per entryType: ${JSON.stringify(CATEGORIES_BY_TYPE)}

If the text is ambiguous or you cannot extract an amount, set confidence below 0.5.
Never invent an amount, supplier, or quantity that isn't stated or clearly implied.`;

async function parseEntryText(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error("Smart Entry isn't configured — OPENAI_API_KEY is missing on the server");
    err.status = 503;
    throw err;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" }, // guarantees valid JSON back, no markdown-fence stripping needed
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const err = new Error(`AI parsing failed (${response.status})`);
    err.status = 502;
    err.detail = body;
    throw err;
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const err = new Error("AI response wasn't valid JSON");
    err.status = 502;
    throw err;
  }

  if (!ENTRY_TYPES.includes(parsed.entryType)) {
    const err = new Error("AI returned an invalid entry type");
    err.status = 422;
    throw err;
  }

  return parsed;
}

module.exports = { parseEntryText };