// Structured error class for the loom substrate.
//
// Errors thrown by lib functions carry a `code` (stable kebab-case
// identifier), a `message` (human-readable line), and optionally a
// `candidates` list (used by disambiguation errors like
// `slug-ambiguous`). Verb handlers catch these and forward to stderr +
// non-zero exit per LOOM-CONVENTIONS.md's error shape.

export class LoomError extends Error {
  code: string;
  candidates: string[] | undefined;
  constructor(code: string, message: string, candidates?: string[]) {
    // Prefix the human-readable reason with the structured code so that
    // `error.message` matches the substrate's `<code>: <reason>` stderr
    // convention. Callers and tests that pattern-match on the code see
    // it; `error.code` is still the canonical structured field.
    super(`${code}: ${message}`);
    this.name = 'LoomError';
    this.code = code;
    this.candidates = candidates;
  }

  toPayload(): { error: string; message: string; candidates?: string[] } {
    const payload: { error: string; message: string; candidates?: string[] } = {
      error: this.code,
      message: this.message,
    };
    if (this.candidates !== undefined) payload.candidates = this.candidates;
    return payload;
  }
}
