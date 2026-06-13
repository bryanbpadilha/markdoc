export default function plugin(md: any) {
  // Inline parser for wiki-style links of the form:
  //   [[Optional Display Text]](identifier-string)
  //
  // The display text is captured on `token.content` and the target
  // identifier is captured on `token.info` (the same field markdown-it's
  // fence uses for its language). The parser downstream maps those
  // into a `wikilink` node with `display` and `target` attributes.
  md.inline.ruler.before('escape', 'wikilink', (state: any, silent: boolean) => {
    const start = state.pos;

    // Must begin with `[[`.
    if (!state.src.startsWith('[[', start)) return false;

    // Find the closing `]]` for the display portion. A single unbalanced
    // `]` inside the display is allowed; only the first `]]` ends it.
    const displayEnd = state.src.indexOf(']]', start + 2);
    if (displayEnd === -1) return false;

    // The target must start with `(` immediately after the `]]`. This
    // makes `[[A]]` (no target) fall through to plain text.
    if (state.src[displayEnd + 2] !== '(') return false;

    // Find the closing `)` for the target.
    const targetEnd = state.src.indexOf(')', displayEnd + 3);
    if (targetEnd === -1) return false;

    if (silent) return true;

    const display = state.src.slice(start + 2, displayEnd);
    const target = state.src.slice(displayEnd + 3, targetEnd);

    const token = state.push('wikilink', '', 0);
    token.content = display;
    token.info = target;

    state.pos = targetEnd + 1;
    return true;
  });
}
