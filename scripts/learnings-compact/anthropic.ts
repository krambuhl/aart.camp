import Anthropic from '@anthropic-ai/sdk';
import type { TokenUsage } from './types';

let _client: Anthropic | null = null;

function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Export it before running /learnings-compact.');
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface CallArgs {
  model: string;
  system: string;
  userMessage: string;
  maxTokens: number;
  tool?: ToolSpec;
  timeoutMs?: number;
}

export interface CallResult {
  text: string | null;
  toolInput: unknown | null;
  usage: TokenUsage;
  stopReason: string | null;
}

function extractUsage(raw: {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): TokenUsage {
  return {
    input: raw.input_tokens ?? 0,
    output: raw.output_tokens ?? 0,
    cache_read: raw.cache_read_input_tokens ?? 0,
    cache_creation: raw.cache_creation_input_tokens ?? 0,
  };
}

export async function callClaude(args: CallArgs): Promise<CallResult> {
  const controller = new AbortController();
  const timeout = args.timeoutMs && args.timeoutMs > 0 ? setTimeout(() => controller.abort(), args.timeoutMs) : null;

  try {
    const req: Anthropic.Messages.MessageCreateParamsNonStreaming = {
      model: args.model,
      max_tokens: args.maxTokens,
      system: args.system,
      messages: [{ role: 'user', content: args.userMessage }],
    };

    if (args.tool) {
      req.tools = [args.tool];
      req.tool_choice = { type: 'tool', name: args.tool.name };
    }

    const res = await client().messages.create(req, {
      signal: controller.signal,
    });

    let text: string | null = null;
    let toolInput: unknown | null = null;
    for (const block of res.content) {
      if (block.type === 'text') {
        text = (text ?? '') + block.text;
      } else if (block.type === 'tool_use') {
        toolInput = block.input;
      }
    }

    return {
      text,
      toolInput,
      usage: extractUsage(res.usage),
      stopReason: res.stop_reason,
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

// Wrap a Claude call with a stable error shape. Errors return a failure
// CallResult with usage=0; never throw. Callers decide what to do with a
// failed call (typically: mark judge as errored and exclude from round).
export async function callClaudeSafe(args: CallArgs): Promise<CallResult & { errored: boolean; errorMessage?: string }> {
  try {
    const r = await callClaude(args);
    return { ...r, errored: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      text: null,
      toolInput: null,
      usage: { input: 0, output: 0, cache_read: 0, cache_creation: 0 },
      stopReason: null,
      errored: true,
      errorMessage: msg,
    };
  }
}
