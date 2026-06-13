import Tokenizer from '..';
import parser from '../../parser';

describe('MarkdownIt custom cite plugin', function () {
  const tokenizer = new Tokenizer();

  function parse(example: string) {
    const content = example.replace(/\n\s+/gm, '\n').trim();
    return tokenizer.tokenize(content);
  }

  function findCite(tokens: any[]): any {
    for (const token of tokens) {
      if (token.type === 'cite') return token;
      if (Array.isArray(token.children)) {
        const found = findCite(token.children);
        if (found) return found;
      }
    }
    return undefined;
  }

  function collectCites(tokens: any[]): any[] {
    const out: any[] = [];
    for (const token of tokens) {
      if (token.type === 'cite') out.push(token);
      if (Array.isArray(token.children)) out.push(...collectCites(token.children));
    }
    return out;
  }

  // -- bare cite ---------------------------------------------------------

  it('parses a bare cite with no config', function () {
    const example = parse(`
    See [@koehler1937] for more.
    `);

    const cite = findCite(example);
    expect(cite).toBeDefined();
    expect(cite.type).toEqual('cite');
    expect(cite.info).toEqual('koehler1937');
    // No config written — content is empty, hasConfig is false, parsed
    // config map is empty.
    expect(cite.content).toEqual('');
    expect(cite.meta?.hasConfig).toBe(false);
    expect(cite.meta?.config).toEqual({});
  });

  it('captures slashes and dots in the target identifier', function () {
    const example = parse(`
    See [@guy.com/hello] for more.
    `);

    const cite = findCite(example);
    expect(cite).toBeDefined();
    expect(cite.info).toEqual('guy.com/hello');
  });

  // -- single kwarg -----------------------------------------------------

  it('parses a single key:value kwarg', function () {
    const example = parse(`
    See [@someEntry, locator: #bla] for more.
    `);

    const cite = findCite(example);
    expect(cite).toBeDefined();
    expect(cite.info).toEqual('someEntry');
    expect(cite.content).toEqual('locator: #bla');
    expect(cite.meta?.hasConfig).toBe(true);
    expect(cite.meta?.config).toEqual({ locator: '#bla' });
  });

  it('strips exactly one leading space after the colon', function () {
    const example = parse(`
    See [@guy1999, locator: p. 20] for more.
    `);

    const cite = findCite(example);
    expect(cite).toBeDefined();
    expect(cite.meta?.config?.locator).toEqual('p. 20');
  });

  it('also accepts `key:value` with no space after the colon', function () {
    const example = parse(`
    See [@guy1999, locator:p. 20] for more.
    `);

    const cite = findCite(example);
    expect(cite).toBeDefined();
    expect(cite.meta?.config?.locator).toEqual('p. 20');
  });

  // -- multiple kwargs ---------------------------------------------------

  it('parses multiple key:value kwargs separated by commas', function () {
    const example = parse(`
    See [@guy.com/hello, author: Guy, year: 2023, title: Hello World] for more.
    `);

    const cite = findCite(example);
    expect(cite).toBeDefined();
    expect(cite.info).toEqual('guy.com/hello');
    expect(cite.meta?.config).toEqual({
      author: 'Guy',
      year: 2023,
      title: 'Hello World',
    });
  });

  it('preserves trailing whitespace inside quoted values', function () {
    const example = parse(`
    See [@guy1999, locator: p. 20, prefix: "see "] for more.
    `);

    const cite = findCite(example);
    expect(cite).toBeDefined();
    expect(cite.meta?.config).toEqual({
      locator: 'p. 20',
      prefix: 'see ',
    });
  });

  // -- quoted values ----------------------------------------------------

  it('respects double-quoted values containing commas', function () {
    const example = parse(`
    See [@id, title: "Hello, World"] for more.
    `);

    const cite = findCite(example);
    expect(cite).toBeDefined();
    expect(cite.meta?.config?.title).toEqual('Hello, World');
  });

  it('respects single-quoted values containing commas', function () {
    const example = parse(`
    See [@id, title: 'Hello, World'] for more.
    `);

    const cite = findCite(example);
    expect(cite).toBeDefined();
    expect(cite.meta?.config?.title).toEqual('Hello, World');
  });

  it('treats a quoted bare value as a positional locator', function () {
    const example = parse(`
    See [@id, "p. 20, sec. 3"] for more.
    `);

    const cite = findCite(example);
    expect(cite).toBeDefined();
    expect(cite.meta?.config?.locator).toEqual('p. 20, sec. 3');
  });

  // -- positional locator ------------------------------------------------

  it('treats a leading bare value with no colon as a positional locator', function () {
    const example = parse(`
    See [@koehler1937, p. 20] for more.
    `);

    const cite = findCite(example);
    expect(cite).toBeDefined();
    expect(cite.info).toEqual('koehler1937');
    expect(cite.meta?.config).toEqual({ locator: 'p. 20' });
  });

  it('recognises a leading `#fragment` as a positional anchor', function () {
    const example = parse(`
    See [@entry, #section-3] for more.
    `);

    const cite = findCite(example);
    expect(cite).toBeDefined();
    expect(cite.meta?.config).toEqual({ locator: '#section-3' });
  });

  it('rejects more than one positional value in the config slice', function () {
    // `[@id, p. 20, sec. 3]` is ambiguous (page + sub-locator?). Users
    // can quote the whole locator if they need both: `[@id, "p. 20,
    // sec. 3"]`. The rejection here is by design.
    const example = parse(`
    See [@id, p. 20, sec. 3] for more.
    `);

    expect(findCite(example)).toBeUndefined();
  });

  // -- scalar coercion ---------------------------------------------------

  it('coerces unquoted numeric and boolean values', function () {
    const example = parse(`
    See [@id, year: 2023, online: true, draft: false, unknown: null] for more.
    `);

    const cite = findCite(example);
    expect(cite).toBeDefined();
    expect(cite.meta?.config).toEqual({
      year: 2023,
      online: true,
      draft: false,
      unknown: null,
    });
  });

  // -- multiple cites ----------------------------------------------------

  it('parses multiple cites in the same paragraph', function () {
    const example = parse(`
    See [@a] and [@b, p. 20] together.
    `);

    const cites = collectCites(example);
    expect(cites.length).toEqual(2);
    expect(cites[0].info).toEqual('a');
    expect(cites[0].meta?.hasConfig).toBe(false);
    expect(cites[1].info).toEqual('b');
    expect(cites[1].meta?.config).toEqual({ locator: 'p. 20' });
  });

  it('parses two adjacent cites back-to-back', function () {
    const example = parse(`
    See [@a][@b].
    `);

    const cites = collectCites(example);
    expect(cites.length).toEqual(2);
    expect(cites[0].info).toEqual('a');
    expect(cites[1].info).toEqual('b');
  });

  // -- whitespace --------------------------------------------------------

  it('tolerates whitespace after the comma', function () {
    const example = parse(`
    See [@id,   locator: p. 20] for more.
    `);

    const cite = findCite(example);
    expect(cite).toBeDefined();
    expect(cite.meta?.config?.locator).toEqual('p. 20');
  });

  it('preserves hasConfig even when the config slice is just whitespace', function () {
    const example = parse(`
    See [@id, ] for more.
    `);

    const cite = findCite(example);
    expect(cite).toBeDefined();
    expect(cite.info).toEqual('id');
    expect(cite.meta?.hasConfig).toBe(true);
    expect(cite.meta?.config).toEqual({});
  });

  // -- fall-through cases -----------------------------------------------

  it('falls back to text when the inner is empty ([@])', function () {
    const example = parse(`
    Empty [@] here.
    `);

    expect(findCite(example)).toBeUndefined();

    const textTokens: string[] = [];
    function collectText(toks: any[]) {
      for (const t of toks) {
        if (t.type === 'text' && t.content) textTokens.push(t.content);
        if (Array.isArray(t.children)) collectText(t.children);
      }
    }
    collectText(example);
    expect(textTokens.join('')).toContain('[@]');
  });

  it('falls back to text when the id is empty ([@, locator: x])', function () {
    const example = parse(`
    Empty [@, locator: x] here.
    `);

    expect(findCite(example)).toBeUndefined();
  });

  it('falls back to text when the closing ] is missing', function () {
    const example = parse(`
    Incomplete [@koehler1937 here.
    `);

    expect(findCite(example)).toBeUndefined();
  });

  it('falls back to text when a quote is never closed', function () {
    const example = parse(`
    Broken [@id, title: "unclosed] for more.
    `);

    expect(findCite(example)).toBeUndefined();
  });

  it('falls back to text on an empty key (": value")', function () {
    const example = parse(`
    Broken [@id, : value] here.
    `);

    expect(findCite(example)).toBeUndefined();
  });

  it('does not match a regular markdown link', function () {
    const example = parse(`
    Just [a link](https://example.com) here.
    `);

    expect(findCite(example)).toBeUndefined();
  });

  it('does not match a bare bracketed word', function () {
    const example = parse(`
    Just [word] in text.
    `);

    expect(findCite(example)).toBeUndefined();
  });

  it('does not cross a line break in search of the closing ]', function () {
    const example = parse(`
    [@koehler1937
    continues on next line]
    `);

    // The `]` is on a different line. A well-formed citation must be
    // single-line.
    expect(findCite(example)).toBeUndefined();
  });
});

describe('Cite Markdoc AST node', function () {
  const tokenizer = new Tokenizer();

  function parseAst(example: string) {
    const content = example.replace(/\n\s+/gm, '\n').trim();
    return parser(tokenizer.tokenize(content), { location: false });
  }

  function findCiteNode(node: any): any {
    if (node.type === 'cite') return node;
    for (const child of node.children || []) {
      const found = findCiteNode(child);
      if (found) return found;
    }
    return undefined;
  }

  it('exposes only target when no config is given', function () {
    const ast = parseAst(`
    See [@koehler1937] for more.
    `);

    const node = findCiteNode(ast);
    expect(node).toBeDefined();
    expect(node.type).toEqual('cite');
    expect(node.attributes.target).toEqual('koehler1937');
    // No config → no `locator` and no other config keys.
    expect('locator' in node.attributes).toBe(false);
  });

  it('spreads parsed config keys into the AST attributes', function () {
    const ast = parseAst(`
    See [@id, locator: p. 20, prefix: "see "] for more.
    `);

    const node = findCiteNode(ast);
    expect(node).toBeDefined();
    expect(node.attributes.target).toEqual('id');
    expect(node.attributes.locator).toEqual('p. 20');
    expect(node.attributes.prefix).toEqual('see ');
  });

  it('the id always wins over a config-supplied target key', function () {
    // The target key is the positional before the first `,`, so it
    // cannot be overridden by config. The renderer's `entry` prop
    // (or whatever the consumer renames `target` to) is always the
    // id, never a config value.
    const ast = parseAst(`
    See [@id, target: otherId] for more.
    `);

    const node = findCiteNode(ast);
    expect(node).toBeDefined();
    expect(node.attributes.target).toEqual('id');
  });

  it('exposes the positional locator on the AST', function () {
    const ast = parseAst(`
    See [@koehler1937, p. 20] for more.
    `);

    const node = findCiteNode(ast);
    expect(node).toBeDefined();
    expect(node.attributes.target).toEqual('koehler1937');
    expect(node.attributes.locator).toEqual('p. 20');
  });
});
