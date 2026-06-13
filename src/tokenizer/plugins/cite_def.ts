// Block-level parser for citation definitions:
//
//   [@note1]: This is a footnote-style note, with [[wikilink]].
//   [@bib.guy1999]: Koehler, Otto. Bulletin of Animal Behavior.
//
// The opening `[@` is the same disambiguator as the inline `cite`
// rule, so a definition can't be confused with a regular link
// reference `[id]: text`. The closing `]` must come on the same
// line; a stray newline means the rule falls through. The literal
// `:` must immediately follow `]` (one optional space), and the
// content runs to the end of the line.
//
// Content is stored on `token.content` as a raw string. Inline
// markdown inside the content (e.g. `[[wikilinks]]`, emphasis,
// links) is NOT re-tokenized by this rule — that is the consumer's
// responsibility. The `cite-def.astro` component is expected to
// call `Markdoc.parse(content)` and render the resulting tree, so
// the same config the rest of the page uses applies to the
// definition's content too. This keeps the tokenizer minimal and
// avoids the recursion pitfalls of inline-tokenizing from a block
// rule.
//
// Token shape:
//   - `token.info`    = the identifier (the part between `[@` and `]`)
//   - `token.content` = the raw inline content (with at most one
//                       leading space stripped), or '' if the
//                       definition is empty after the colon
//   - `token.block`   = true (block-level)
//   - `token.map`     = [startLine, startLine + 1] so the parser
//                       can attach location info
//
// The grammar is intentionally narrow: single-line, no
// continuations, no `:` inside the content. Multi-line definitions
// are a future concern; for now users who need a long definition
// can put it in a paragraph below a `[@id]:` marker.
export default function plugin(md: any) {
  md.block.ruler.before(
    'fence',
    'cite_def',
    (state: any, startLine: number, endLine: number, silent: boolean) => {
      // The line's start position, after any leading indentation
      // (e.g. inside a list item or blockquote — though we don't
      // allow that yet, the offset calculation is standard).
      const lineStart = state.bMarks[startLine] + state.tShift[startLine];
      const lineEnd = state.eMarks[startLine];

      // Must begin with `[@`.
      if (!state.src.startsWith('[@', lineStart)) return false;

      // Find the closing `]` on the same line. If it doesn't exist
      // here, this is not a cite_def — fall through to paragraph.
      const closeIdx = state.src.indexOf(']', lineStart + 2);
      if (closeIdx === -1 || closeIdx >= lineEnd) return false;

      const id = state.src.slice(lineStart + 2, closeIdx).trim();
      if (id.length === 0) return false; // `[@]` is not a valid id

      // `:` must immediately follow `]`, with at most one space.
      let p = closeIdx + 1;
      if (p >= lineEnd || state.src[p] !== ':') return false;
      p++;
      if (p < lineEnd && state.src[p] === ' ') p++;

      // Content is whatever remains on the line. Trailing whitespace
      // is left as-is — the consumer can `.trim()` if it cares, and
      // we don't want to silently eat a meaningful trailing space
      // (the rule's job is to capture the slice, not normalise it).
      const content = state.src.slice(p, lineEnd);

      if (silent) return true;

      const token = state.push('cite_def', 'div', 0);
      token.info = id;
      token.content = content;
      token.block = true;
      token.map = [startLine, startLine + 1];

      state.line = startLine + 1;
      return true;
    }
    // No `alt` — a `[@id]:` line should not preempt any other block
    // rule; it either matches here or falls through to a paragraph.
  );
}
