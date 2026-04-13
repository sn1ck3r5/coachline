const MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-20250514-v1:0";
const REGION = process.env.BEDROCK_REGION || "us-west-2";

function getApiKey(): string {
  const encoded = process.env.BEDROCK_API_KEY;
  if (!encoded) throw new Error("BEDROCK_API_KEY environment variable is required");
  // The key may be base64-encoded or plain — try decoding, fall back to plain
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    if (decoded.startsWith("BedrockAPIKey")) return decoded;
  } catch {}
  return encoded;
}

interface BedrockMessage {
  role: "user" | "assistant";
  content: string;
}

export async function invokeClaudeJson<T>(
  systemPrompt: string,
  messages: BedrockMessage[]
): Promise<T> {
  const apiKey = getApiKey();
  const url = `https://bedrock-runtime.${REGION}.amazonaws.com/model/${encodeURIComponent(MODEL_ID)}/invoke`;

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 8192,
    system: systemPrompt,
    messages,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "x-api-key": apiKey,
    },
    body,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Bedrock API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const responseBody = await response.json();
  const text: string = responseBody.content[0].text;

  // Extract JSON from response (may be wrapped in markdown code blocks)
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || [null, text];
  return JSON.parse(jsonMatch[1]!.trim()) as T;
}
