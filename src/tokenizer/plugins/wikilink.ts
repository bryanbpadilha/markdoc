export default function plugin(md: any) {
  // Inline parser for Obsidian-style wiki links:
  //   [[target]]
  //   [[target|Display Text]]
  //
  // The target is the required identifier; the display text after the
  // `|` is optional. The first `|` is the separator — anything after
  // it is treated as the display text literally, so `[[a|b|c]]` is
  // parsed as target="a", display="b|c" (matching Obsidian).
  //
  // Token shape:
  //   - `token.info`    = the target identifier
  //   - `token.content` = the display text, or '' if the user did not
  //                       write a `|...` portion
  //   - `token.meta.hasDisplay` = true when a `|...` portion was written
  //     (even if it is empty). Downstream consumers should consult this
  //     flag to decide whether to fall back to a derived label (e.g.
  //     an entry's title) or honor the literal display value.
  md.inline.ruler.before('escape', 'wikilink', (state: any, silent: boolean) => {
    const start = state.pos;

    // Must begin with `[[`.
    if (!state.src.startsWith('[[', start)) return false;

    // Find the closing `]]`. A single unbalanced `]` inside the target
    // or display is allowed; only the first `]]` ends the wikilink.
    const closeIdx = state.src.indexOf(']]', start + 2);
    if (closeIdx === -1) return false;

    const inner = state.src.slice(start + 2, closeIdx);

    // `[[]]` is not a valid wikilink — fall through to plain text.
    if (inner.length === 0) return false;

    if (silent) return true;

    // Split on the first `|` to separate target from display.
    const pipeIdx = inner.indexOf('|');
    let target: string;
    let display: string | undefined;
    if (pipeIdx === -1) {
      target = inner;
    } else {
      target = inner.slice(0, pipeIdx);
      display = inner.slice(pipeIdx + 1);
    }

    // An empty target (e.g. `[[|display]]`) is not a valid link.
    if (target.length === 0) return false;

    const token = state.push('wikilink', '', 0);
    token.info = target;
    token.content = display ?? '';

    // Record whether the user wrote a `|...` portion so that downstream
    // consumers can distinguish `[[target]]` (no display, may fall back)
    // from `[[target|]]` (explicit empty display, honor literally).
    if (display !== undefined) {
      token.meta = { ...(token.meta || {}), hasDisplay: true };
    }

    state.pos = closeIdx + 2;
    return true;
  });
}
