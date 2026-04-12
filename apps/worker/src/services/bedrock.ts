import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || "us-east-1",
});

const MODEL_ID = "anthropic.claude-sonnet-4-20250514";

interface BedrockMessage {
  role: "user" | "assistant";
  content: string;
}

export async function invokeClaudeJson<T>(
  systemPrompt: string,
  messages: BedrockMessage[]
): Promise<T> {
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 8192,
    system: systemPrompt,
    messages,
  });

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: new TextEncoder().encode(body),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const text: string = responseBody.content[0].text;

  // Extract JSON from response (may be wrapped in markdown code blocks)
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || [null, text];
  return JSON.parse(jsonMatch[1]!.trim()) as T;
}
