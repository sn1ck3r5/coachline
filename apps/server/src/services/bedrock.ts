const MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-20250514-v1:0";
const REGION = process.env.BEDROCK_REGION || "us-west-2";

function getApiKey(): string {
  const key = process.env.BEDROCK_API_KEY;
  if (!key) throw new Error("BEDROCK_API_KEY environment variable is required");
  return key;
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
      "Authorization": `Bearer ${apiKey}`,
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
