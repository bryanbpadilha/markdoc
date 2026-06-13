export default function plugin(md: any) {
  // Inline parser for citation references:
  //
  //   [@target]
  //   [@target, locator: p. 20]
  //   [@target, kind: bibtex, locator: p. 20, prefix: "see "]
  //   [@target, p. 20]                // positional shorthand: first bare value -> locator
  //
  // The opening `[@` is the disambiguator from a regular markdown link
  // `[text](url)`. The closing `]` is found by a forward scan that
  // respects `"..."` and `'...'` quoted strings; an unclosed quote or
  // a missing `]` causes the rule to fall through to plain text.
  //
  // The config slice is parsed as a hand-rolled subset of YAML flow
  // style: comma-separated `key: value` pairs. A leading bare value
  // (no `:`) is treated as a positional `locator`. Values containing
  // `,`, `:`, or other reserved characters must be quoted with `"` or
  // `'`. We deliberately do not pull in a full YAML library for this —
  // the grammar we need is tiny, well-bounded, and a real YAML
  // dependency would force the consumer app to ship a new transitive
  // dep for the sake of `[@key, p. 20]`.
  //
  // Token shape:
  //   - `token.info`           = the target identifier (the part
  //                              before the first top-level `,`)
  //   - `token.content`        = the raw config slice, with leading
  //                              and trailing whitespace stripped.
  //                              Empty string when no config was
  //                              written.
  //   - `token.meta.hasConfig` = true when a comma was present, even
  //                              if the config slice is otherwise
  //                              empty / whitespace-only. Lets the
  //                              parser distinguish `[@id]` (no
  //                              config at all) from `[@id, ]`
  //                              (explicitly empty config).
  //   - `token.meta.config`    = parsed key/value object, or `{}`
  //                              when no config was given.
  md.inline.ruler.before('escape', 'cite', (state: any, silent: boolean) => {
    const start = state.pos;

    // Must begin with `[@`.
    if (!state.src.startsWith('[@', start)) return false;

    const innerStart = start + 2;
    const closeIdx = findCloseBracket(state.src, innerStart);
    if (closeIdx === -1) return false;

    const inner = state.src.slice(innerStart, closeIdx);

    // `[@]` is not a valid citation — fall through to plain text.
    if (inner.length === 0) return false;

    const parsed = parseCite(inner);
    if (parsed === null) return false; // malformed → fall through

    if (silent) return true;

    const token = state.push('cite', '', 0);
    token.info = parsed.target;
    token.content = parsed.configRaw;
    token.meta = {
      ...(token.meta || {}),
      hasConfig: parsed.hasConfig,
      config: parsed.config,
    };

    state.pos = closeIdx + 1;
    return true;
  });
}

// --- scanning helpers ---------------------------------------------------

// Find the matching `]` for a `[@...]` opener, respecting `"..."` and
// `'...'` quoted strings. Returns -1 if no matching `]` is found or if
// a quote is opened and never closed. Single-line: we stop at the
// first newline so that a stray `[` in the next paragraph doesn't
// swallow content.
function findCloseBracket(src: string, start: number): number {
  for (let pos = start; pos < src.length; pos++) {
    const ch = src[pos];
    if (ch === '\n') return -1;
    if (ch === '"' || ch === "'") {
      const close = findCloseQuote(src, pos);
      if (close === -1) return -1;
      pos = close;
      continue;
    }
    if (ch === ']') return pos;
  }
  return -1;
}

// Find the matching close-quote for a quote at `start`. No escape
// handling — we deliberately keep the grammar tiny, and `\` inside a
// quoted string is preserved literally. The opening quote is whatever
// character is at `start`.
function findCloseQuote(src: string, start: number): number {
  const quote = src[start];
  for (let pos = start + 1; pos < src.length; pos++) {
    if (src[pos] === quote) return pos;
  }
  return -1;
}

// Find the first occurrence of `ch` at the top level (i.e. not inside
// a quoted string). Returns -1 if not found.
function findTopLevel(s: string, ch: string): number {
  for (let pos = 0; pos < s.length; pos++) {
    const c = s[pos];
    if (c === '"' || c === "'") {
      const close = findCloseQuote(s, pos);
      if (close === -1) return -1;
      pos = close;
      continue;
    }
    if (c === ch) return pos;
  }
  return -1;
}

// Split `s` on top-level occurrences of `sep` (a single character),
// respecting quoted strings.
function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let pos = 0; pos < s.length; pos++) {
    const ch = s[pos];
    if (ch === '"' || ch === "'") {
      const close = findCloseQuote(s, pos);
      if (close === -1) {
        // Unclosed quote — emit the rest as a final piece so callers
        // can decide what to do. (Our caller treats this as a
        // fall-through-to-text condition.)
        out.push(s.slice(start));
        return out;
      }
      pos = close;
      continue;
    }
    if (ch === sep) {
      out.push(s.slice(start, pos));
      start = pos + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}

// Strip one pair of matching outer quotes from a value, if present.
function unquote(s: string): string {
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return s.slice(1, -1);
    }
  }
  return s;
}

// --- parser --------------------------------------------------------------

interface ParsedCite {
  target: string;
  configRaw: string;
  hasConfig: boolean;
  config: Record<string, string | number | boolean | null>;
}

function parseCite(inner: string): ParsedCite | null {
  // Split on the first top-level `,` to separate id from config.
  const split = splitIdFromConfig(inner);
  if (split === null) return null;

  const { id, rest, hasConfig } = split;
  if (id.length === 0) return null; // `[@, ...]` is not a valid cite

  const config: Record<string, string | number | boolean | null> = {};
  let configRaw = '';
  if (hasConfig) {
    // Strip surrounding whitespace from the config slice; this is
    // what gets stored on `token.content` and what consumers will
    // see in diagnostics. The trimmed slice is what the parser feeds
    // to `parseConfig`.
    configRaw = rest.trim();
    const trimmed = rest.trim();
    if (trimmed.length > 0) {
      const parsed = parseConfig(trimmed);
      if (parsed === null) return null; // malformed
      Object.assign(config, parsed);
    }
  }

  return { target: id, configRaw, hasConfig, config };
}

interface IdConfigSplit {
  id: string;
  rest: string;
  hasConfig: boolean;
}

function splitIdFromConfig(inner: string): IdConfigSplit | null {
  for (let pos = 0; pos < inner.length; pos++) {
    const ch = inner[pos];
    if (ch === '"' || ch === "'") {
      const close = findCloseQuote(inner, pos);
      if (close === -1) return null; // unclosed quote → fall through
      pos = close;
      continue;
    }
    if (ch === ',') {
      return {
        id: inner.slice(0, pos).trim(),
        rest: inner.slice(pos + 1),
        hasConfig: true,
      };
    }
  }
  return {
    id: inner.trim(),
    rest: '',
    hasConfig: false,
  };
}

function parseConfig(
  config: string
): Record<string, string | number | boolean | null> | null {
  const result: Record<string, string | number | boolean | null> = {};
  const entries = splitTopLevel(config, ',');
  let sawPositional = false;

  for (const raw of entries) {
    const entry = raw.trim();
    if (entry.length === 0) continue; // tolerate `[@id, , foo: bar]`

    const colonIdx = findTopLevel(entry, ':');
    if (colonIdx === -1) {
      // No colon → positional value. The first (and, for now, only)
      // positional becomes `locator`. A second positional is rejected
      // so the grammar stays simple; users can always quote a
      // multi-part locator, e.g. `[@id, "p. 20, sec. 3"]`.
      if (sawPositional) return null;
      sawPositional = true;
      result.locator = unquote(entry);
      continue;
    }

    const key = entry.slice(0, colonIdx).trim();
    if (key.length === 0) return null; // `: value` with no key

    let valuePart = entry.slice(colonIdx + 1);
    // Strip exactly one leading space — this is the conventional
    // `key: value` form. The space is not part of the value.
    if (valuePart.startsWith(' ')) valuePart = valuePart.slice(1);

    result[key] = parseScalar(unquote(valuePart.trim()));
  }

  return result;
}

// Coerce a value to a typed scalar. Strings stay strings; the literal
// tokens `true`, `false`, `null` and bare numbers become their JS
// counterparts. Everything else is a string.
function parseScalar(value: string): string | number | boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (value !== '' && /^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}
