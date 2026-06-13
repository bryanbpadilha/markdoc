import Tokenizer from '..';
import parser from '../../parser';

describe('MarkdownIt custom wikilink plugin', function () {
  const tokenizer = new Tokenizer();

  function parse(example: string) {
    const content = example.replace(/\n\s+/gm, '\n').trim();
    return tokenizer.tokenize(content);
  }

  function findWikilink(tokens: any[]): any {
    for (const token of tokens) {
      if (token.type === 'wikilink') return token;
      if (Array.isArray(token.children)) {
        const found = findWikilink(token.children);
        if (found) return found;
      }
    }
    return undefined;
  }

  function collectWikilinks(tokens: any[]): any[] {
    const out: any[] = [];
    for (const token of tokens) {
      if (token.type === 'wikilink') out.push(token);
      if (Array.isArray(token.children)) out.push(...collectWikilinks(token.children));
    }
    return out;
  }

  it('parses a basic wikilink with display and target', function () {
    const example = parse(`
    See [[Display Text]](my-entry) for more.
    `);

    const wikilink = findWikilink(example);
    expect(wikilink).toBeDefined();
    expect(wikilink.type).toEqual('wikilink');
    expect(wikilink.content).toEqual('Display Text');
    expect(wikilink.info).toEqual('my-entry');
  });

  it('allows an empty display (per the spec "Optional Display Text")', function () {
    const example = parse(`
    See [[]](my-entry) for more.
    `);

    const wikilink = findWikilink(example);
    expect(wikilink).toBeDefined();
    expect(wikilink.content).toEqual('');
    expect(wikilink.info).toEqual('my-entry');
  });

  it('captures slashes inside the target identifier', function () {
    const example = parse(`
    See [[Path]](path/to/entry) for more.
    `);

    const wikilink = findWikilink(example);
    expect(wikilink).toBeDefined();
    expect(wikilink.content).toEqual('Path');
    expect(wikilink.info).toEqual('path/to/entry');
  });

  it('parses multiple wikilinks in the same paragraph', function () {
    const example = parse(`
    See [[A]](entry-a) and [[B]](entry-b) together.
    `);

    const wikilinks = collectWikilinks(example);
    expect(wikilinks.length).toEqual(2);
    expect(wikilinks[0].content).toEqual('A');
    expect(wikilinks[0].info).toEqual('entry-a');
    expect(wikilinks[1].content).toEqual('B');
    expect(wikilinks[1].info).toEqual('entry-b');
  });

  it('falls back to text when the target parentheses are missing', function () {
    const example = parse(`
    Not a [[link]] here.
    `);

    expect(findWikilink(example)).toBeUndefined();

    // The original `[[link]]` should still appear as raw text.
    const textTokens: string[] = [];
    function collectText(toks: any[]) {
      for (const t of toks) {
        if (t.type === 'text' && t.content) textTokens.push(t.content);
        if (Array.isArray(t.children)) collectText(t.children);
      }
    }
    collectText(example);
    expect(textTokens.join('')).toContain('[[link]]');
  });

  it('falls back to text when the target paren is unclosed', function () {
    const example = parse(`
    Broken [[Display]](my-entry
    `);

    expect(findWikilink(example)).toBeUndefined();
  });

  it('falls back to text when the closing ]] is missing', function () {
    const example = parse(`
    Incomplete [[Display](my-entry)
    `);

    expect(findWikilink(example)).toBeUndefined();
  });

  it('does not match a single [ link', function () {
    const example = parse(`
    Just [a link](https://example.com) here.
    `);

    expect(findWikilink(example)).toBeUndefined();
  });
});

describe('Wikilink Markdoc AST node', function () {
  const tokenizer = new Tokenizer();

  function parseAst(example: string) {
    const content = example.replace(/\n\s+/gm, '\n').trim();
    return parser(tokenizer.tokenize(content), { location: false });
  }

  function findWikilinkNode(node: any): any {
    if (node.type === 'wikilink') return node;
    for (const child of node.children || []) {
      const found = findWikilinkNode(child);
      if (found) return found;
    }
    return undefined;
  }

  it('exposes display and target as node attributes', function () {
    const ast = parseAst(`
    See [[Display Text]](my-entry) for more.
    `);

    const node = findWikilinkNode(ast);
    expect(node).toBeDefined();
    expect(node.type).toEqual('wikilink');
    expect(node.attributes.display).toEqual('Display Text');
    expect(node.attributes.target).toEqual('my-entry');
  });

  it('preserves empty display', function () {
    const ast = parseAst(`
    See [[]](my-entry).
    `);

    const node = findWikilinkNode(ast);
    expect(node).toBeDefined();
    expect(node.attributes.display).toEqual('');
    expect(node.attributes.target).toEqual('my-entry');
  });
});
