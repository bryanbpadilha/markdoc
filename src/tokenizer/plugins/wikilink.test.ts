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

  it('parses a bare wikilink with no display (target only)', function () {
    const example = parse(`
    See [[my-entry]] for more.
    `);

    const wikilink = findWikilink(example);
    expect(wikilink).toBeDefined();
    expect(wikilink.type).toEqual('wikilink');
    expect(wikilink.info).toEqual('my-entry');
    // No `|...` portion was written — `content` is empty and the
    // `hasDisplay` flag is absent, so consumers should fall back to
    // a derived label.
    expect(wikilink.content).toEqual('');
    expect(wikilink.meta?.hasDisplay).toBeFalsy();
  });

  it('parses a wikilink with an explicit display text', function () {
    const example = parse(`
    See [[my-entry|Display Text]] for more.
    `);

    const wikilink = findWikilink(example);
    expect(wikilink).toBeDefined();
    expect(wikilink.info).toEqual('my-entry');
    expect(wikilink.content).toEqual('Display Text');
    expect(wikilink.meta?.hasDisplay).toBe(true);
  });

  it('honors an explicit empty display literally', function () {
    const example = parse(`
    See [[my-entry|]] for more.
    `);

    const wikilink = findWikilink(example);
    expect(wikilink).toBeDefined();
    expect(wikilink.info).toEqual('my-entry');
    expect(wikilink.content).toEqual('');
    // `hasDisplay` is true because the user wrote `|`, even though the
    // display is empty. This is the signal that lets consumers avoid
    // falling back to a derived label.
    expect(wikilink.meta?.hasDisplay).toBe(true);
  });

  it('captures slashes inside the target identifier', function () {
    const example = parse(`
    See [[path/to/entry]] for more.
    `);

    const wikilink = findWikilink(example);
    expect(wikilink).toBeDefined();
    expect(wikilink.info).toEqual('path/to/entry');
  });

  it('treats the first | as the separator, leaving later | chars in the display', function () {
    const example = parse(`
    See [[target|a|b|c]] here.
    `);

    const wikilink = findWikilink(example);
    expect(wikilink).toBeDefined();
    expect(wikilink.info).toEqual('target');
    expect(wikilink.content).toEqual('a|b|c');
  });

  it('parses multiple wikilinks in the same paragraph', function () {
    const example = parse(`
    See [[entry-a]] and [[entry-b|Label B]] together.
    `);

    const wikilinks = collectWikilinks(example);
    expect(wikilinks.length).toEqual(2);
    expect(wikilinks[0].info).toEqual('entry-a');
    expect(wikilinks[0].meta?.hasDisplay).toBeFalsy();
    expect(wikilinks[1].info).toEqual('entry-b');
    expect(wikilinks[1].content).toEqual('Label B');
    expect(wikilinks[1].meta?.hasDisplay).toBe(true);
  });

  it('falls back to text when the inner is empty ([[]])', function () {
    const example = parse(`
    Empty [[]] here.
    `);

    expect(findWikilink(example)).toBeUndefined();

    const textTokens: string[] = [];
    function collectText(toks: any[]) {
      for (const t of toks) {
        if (t.type === 'text' && t.content) textTokens.push(t.content);
        if (Array.isArray(t.children)) collectText(t.children);
      }
    }
    collectText(example);
    expect(textTokens.join('')).toContain('[[]]');
  });

  it('falls back to text when the target is empty ([[|display]])', function () {
    const example = parse(`
    See [[|orphan]] here.
    `);

    expect(findWikilink(example)).toBeUndefined();
  });

  it('falls back to text when the closing ]] is missing', function () {
    const example = parse(`
    Incomplete [[my-entry here.
    `);

    expect(findWikilink(example)).toBeUndefined();
  });

  it('does not match a regular markdown link', function () {
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

  it('exposes only target when no display is given', function () {
    const ast = parseAst(`
    See [[my-entry]] for more.
    `);

    const node = findWikilinkNode(ast);
    expect(node).toBeDefined();
    expect(node.type).toEqual('wikilink');
    expect(node.attributes.target).toEqual('my-entry');
    // No `display` attribute on the AST node — consumers should fall back.
    expect('display' in node.attributes).toBe(false);
  });

  it('exposes both target and display when given', function () {
    const ast = parseAst(`
    See [[my-entry|Display Text]] for more.
    `);

    const node = findWikilinkNode(ast);
    expect(node).toBeDefined();
    expect(node.attributes.target).toEqual('my-entry');
    expect(node.attributes.display).toEqual('Display Text');
  });

  it('exposes empty display as an empty string when explicit', function () {
    const ast = parseAst(`
    See [[my-entry|]] for more.
    `);

    const node = findWikilinkNode(ast);
    expect(node).toBeDefined();
    expect(node.attributes.target).toEqual('my-entry');
    expect(node.attributes.display).toEqual('');
  });
});
