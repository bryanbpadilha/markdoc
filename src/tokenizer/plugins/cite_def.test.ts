import Tokenizer from '..';
import parser from '../../parser';

describe('MarkdownIt custom cite_def plugin', function () {
  const tokenizer = new Tokenizer();

  function parse(example: string) {
    // Strip leading indentation (tabs/spaces) from each line so
    // source-level formatting doesn't bleed into the parser input,
    // but preserve blank lines — collapsing `\n\n` to `\n` would
    // merge separate blocks into a single paragraph and prevent
    // block-level rules (like cite_def) from firing. We also add a
    // trailing newline if missing: markdown-it does not run block
    // rules on inputs without proper line termination, so a single
    // short cite_def like `[@id]: x` would otherwise be dropped on
    // the floor.
    let content = example.replace(/^[ \t]+/gm, '');
    if (!content.endsWith('\n')) content += '\n';
    return tokenizer.tokenize(content);
  }

  function findCiteDef(tokens: any[]): any {
    for (const token of tokens) {
      if (token.type === 'cite_def') return token;
      if (Array.isArray(token.children)) {
        const found = findCiteDef(token.children);
        if (found) return found;
      }
    }
    return undefined;
  }

  function collectCiteDefs(tokens: any[]): any[] {
    const out: any[] = [];
    for (const token of tokens) {
      if (token.type === 'cite_def') out.push(token);
      if (Array.isArray(token.children)) out.push(...collectCiteDefs(token.children));
    }
    return out;
  }

  // -- positive cases ----------------------------------------------------

  it('parses a basic cite_def with simple content', function () {
    const example = parse(`
    [@note1]: This is a note.
    `);

    const def = findCiteDef(example);
    expect(def).toBeDefined();
    expect(def.type).toEqual('cite_def');
    expect(def.info).toEqual('note1');
    expect(def.content).toEqual('This is a note.');
    expect(def.block).toBe(true);
  });

  it('parses a cite_def whose content contains a wikilink', function () {
    // The raw content is captured as a string; the consumer is
    // responsible for re-parsing it as inline markdown so the
    // `[[another-entry]]` becomes a wikilink.
    const example = parse(`
    [@note1]: Note 1, [[another-entry]].
    `);

    const def = findCiteDef(example);
    expect(def).toBeDefined();
    expect(def.info).toEqual('note1');
    expect(def.content).toEqual('Note 1, [[another-entry]].');
  });

  it('captures slashes, dots, and hyphens in the identifier', function () {
    const example = parse(`
    [@guy.com/hello-2023]: A multi-part id.
    `);

    const def = findCiteDef(example);
    expect(def).toBeDefined();
    expect(def.info).toEqual('guy.com/hello-2023');
    expect(def.content).toEqual('A multi-part id.');
  });

  it('parses a cite_def with empty content', function () {
    const example = parse(`
    [@note1]:
    `);

    const def = findCiteDef(example);
    expect(def).toBeDefined();
    expect(def.info).toEqual('note1');
    expect(def.content).toEqual('');
  });

  it('parses a cite_def with content but no trailing space after the colon', function () {
    const example = parse(`
    [@note1]:content
    `);

    const def = findCiteDef(example);
    expect(def).toBeDefined();
    expect(def.info).toEqual('note1');
    expect(def.content).toEqual('content');
  });

  it('parses a cite_def with only-whitespace content', function () {
    const example = parse(`
    [@note1]:   
    `);

    const def = findCiteDef(example);
    expect(def).toBeDefined();
    expect(def.info).toEqual('note1');
    // Exactly one space is consumed; the rest stays.
    expect(def.content).toEqual('  ');
  });

  it('parses a cite_def at the start of a document', function () {
    const example = parse(`[@first]: first definition.

Some prose after.`);

    const def = findCiteDef(example);
    expect(def).toBeDefined();
    expect(def.info).toEqual('first');
  });

  it('parses multiple cite_defs in a row', function () {
    const example = parse(`
    [@a]: First.
    [@b]: Second.
    [@c]: Third.
    `);

    const defs = collectCiteDefs(example);
    expect(defs.length).toEqual(3);
    expect(defs.map((d) => d.info)).toEqual(['a', 'b', 'c']);
    expect(defs.map((d) => d.content)).toEqual(['First.', 'Second.', 'Third.']);
  });

  it('co-exists with inline cite nodes in the same document', function () {
    const example = parse(`
    See [@note1] for more.

    [@note1]: This is the note.
    `);

    const def = findCiteDef(example);
    expect(def).toBeDefined();
    expect(def.info).toEqual('note1');
    // The inline cite is somewhere in the tree; this just checks
    // the def is found alongside it.
  });

  it('does not eat lines after the definition', function () {
    const example = parse(`
    [@note1]: This is a note.

    This is a paragraph that should still be parsed.
    `);

    // Both the cite_def and the paragraph should appear.
    const types = example.map((t: any) => t.type);
    expect(types).toContain('cite_def');
    expect(types).toContain('paragraph_open');
  });

  // -- fall-through cases -----------------------------------------------

  it('falls through when the closing ] is missing', function () {
    const example = parse(`
    [@note1 this is not a def
    `);

    expect(findCiteDef(example)).toBeUndefined();
  });

  it('falls through when the colon is missing', function () {
    const example = parse(`
    [@note1] just a bracketed phrase
    `);

    expect(findCiteDef(example)).toBeUndefined();
  });

  it('falls through when there is whitespace between ] and :', function () {
    // Markdown link reference definitions allow a space, but for
    // cite_def we want a tighter grammar so it can't be confused
    // with prose like `[@note1] : this looks like a sentence`.
    const example = parse(`
    [@note1] : content
    `);

    expect(findCiteDef(example)).toBeUndefined();
  });

  it('falls through when the identifier is empty ([@])', function () {
    const example = parse(`
    [@]: content
    `);

    expect(findCiteDef(example)).toBeUndefined();
  });

  it('does not match a regular markdown link reference definition', function () {
    const example = parse(`
    [note1]: This is a regular markdown link ref, not a cite_def.
    `);

    // The opening `[@` is what disambiguates. A plain `[id]:` is a
    // link reference definition and should not be claimed.
    expect(findCiteDef(example)).toBeUndefined();
  });

  it('does not match a line that starts with a paragraph', function () {
    const example = parse(`
    This is a paragraph that mentions [@note1] in prose.
    `);

    // The inline `[@note1]` (no colon) should not be promoted to a
    // block-level cite_def.
    expect(findCiteDef(example)).toBeUndefined();
  });
});

describe('Cite_def Markdoc AST node', function () {
  const tokenizer = new Tokenizer();

  function parseAst(example: string) {
    // Same leading-indent-only trim and trailing-newline append as
    // `parse` — see comment there.
    let content = example.replace(/^[ \t]+/gm, '');
    if (!content.endsWith('\n')) content += '\n';
    return parser(tokenizer.tokenize(content), { location: false });
  }

  function findCiteDefNode(node: any): any {
    if (node.type === 'cite_def') return node;
    for (const child of node.children || []) {
      const found = findCiteDefNode(child);
      if (found) return found;
    }
    return undefined;
  }

  it('exposes target and content as AST attributes', function () {
    const ast = parseAst(`
    [@note1]: This is a note, with [[another-entry]].
    `);

    const node = findCiteDefNode(ast);
    expect(node).toBeDefined();
    expect(node.type).toEqual('cite_def');
    expect(node.attributes.target).toEqual('note1');
    // Content is the raw string. The consumer-side component is
    // expected to re-parse this with Markdoc.parse() and render
    // the resulting tree so `[[another-entry]]` becomes a wikilink.
    expect(node.attributes.content).toEqual(
      'This is a note, with [[another-entry]].'
    );
  });

  it('exposes an empty content string when the definition is empty', function () {
    const ast = parseAst(`
    [@note1]:
    `);

    const node = findCiteDefNode(ast);
    expect(node).toBeDefined();
    expect(node.attributes.target).toEqual('note1');
    expect(node.attributes.content).toEqual('');
  });
});
