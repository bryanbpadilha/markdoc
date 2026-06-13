// End-to-end smoke test that runs the new `[@...]` citation syntax
// through the markdoc pipeline with a config that mirrors zetapedia's
// markdoc.config.ts. The render target is `a` (an HTML tag) so we can
// see the produced attributes without needing to resolve the Astro
// component.
//
// This file is consumed by jasmine and the spec results show up in
// the normal test run. The skill recommends this as the way to
// surface handleAttrs / schema.children gaps.

import Markdoc from '../../..';
import Tokenizer from '..';
import parser from '../../parser';

describe('Cite end-to-end (mirrors zetapedia markdoc.config)', function () {
  const tokenizer = new Tokenizer();

  // Config that mirrors zetapedia/markdoc.config.ts, minus the Astro
  // `component(...)` render — we substitute plain HTML tags here so
  // the renderer can produce output we can assert on. Every attribute
  // the user might write in the config slice is declared; anything
  // missing is dropped by the validator.
  const config: any = {
    nodes: {
      cite: {
        render: 'a',
        attributes: {
          target: { type: String, render: 'entry' },
          locator: { type: String },
          prefix: { type: String },
          suffix: { type: String },
          kind: { type: String },
          author: { type: String },
          year: { type: Number },
          title: { type: String },
        },
      },
      wikilink: {
        render: 'a',
        attributes: {
          target: { type: String, render: 'entry' },
          display: { type: String, render: 'label' },
        },
      },
    },
  };

  function render(src: string): string {
    const ast = parser(tokenizer.tokenize(src), { location: false });
    return Markdoc.renderers.html(Markdoc.transform(ast, config));
  }

  it('renders a bare cite with target renamed to entry', function () {
    const html = render('See [@koehler1937] for more.');
    // The consumer config renames `target` to `entry` for the component.
    expect(html).toContain('entry="koehler1937"');
  });

  it('renders a positional locator', function () {
    const html = render('See [@koehler1937, p. 20] for more.');
    expect(html).toContain('entry="koehler1937"');
    expect(html).toContain('locator="p. 20"');
  });

  it('renders an anchor as a locator', function () {
    const html = render('See [@entry, #section-3] for more.');
    expect(html).toContain('entry="entry"');
    expect(html).toContain('locator="#section-3"');
  });

  it('renders an explicit locator', function () {
    const html = render('See [@guy1999, locator: p. 20] for more.');
    expect(html).toContain('entry="guy1999"');
    expect(html).toContain('locator="p. 20"');
  });

  it('renders multiple kwargs as attributes', function () {
    const html = render(
      'See [@guy.com/hello, author: Guy, year: 2023, title: Hello World].'
    );
    expect(html).toContain('entry="guy.com/hello"');
    expect(html).toContain('author="Guy"');
    expect(html).toContain('year="2023"');
    expect(html).toContain('title="Hello World"');
  });

  it('handles quoted values containing commas', function () {
    const html = render('See [@id, title: "Hello, World"] for more.');
    expect(html).toContain('title="Hello, World"');
    // The single attribute should not have been split on the comma.
    expect(html).not.toContain('World"] for more');
  });

  it('handles a quoted positional locator', function () {
    const html = render('See [@id, "p. 20, sec. 3"] for more.');
    expect(html).toContain('locator="p. 20, sec. 3"');
  });

  it('preserves trailing whitespace inside quoted values', function () {
    const html = render(
      'See [@guy1999, locator: p. 20, prefix: "see "] for more.'
    );
    expect(html).toContain('locator="p. 20"');
    // `prefix` is declared as String but the `see ` value has a
    // trailing space — make sure it survives the round trip.
    expect(html).toContain('prefix="see "');
  });

  it('renders two adjacent cites', function () {
    const html = render('See [@a] and [@b, p. 20].');
    const matches = html.match(/entry="[^"]*"/g) || [];
    expect(matches.length).toEqual(2);
    expect(html).toContain('entry="a"');
    expect(html).toContain('entry="b"');
  });

  it('co-exists with wikilinks in the same paragraph', function () {
    const html = render('See [[my-entry]] citing [@key, p. 20].');
    expect(html).toContain('entry="key"');
    expect(html).toContain('locator="p. 20"');
    // The wikilink should still render through its own config.
    expect(html).toMatch(/href="[^"]*my-entry[^"]*"|<a [^>]*my-entry/);
  });

  // -- negative cases: must fall through to plain text ------------------

  it('falls through to text when the cite is empty', function () {
    const html = render('Empty [@] here.');
    expect(html).not.toContain('entry=');
    expect(html).toContain('[@]');
  });

  it('falls through to text when the closing bracket is missing', function () {
    const html = render('Incomplete [@koehler1937 here.');
    expect(html).not.toContain('entry=');
  });

  it('falls through to text on an unclosed quote', function () {
    const html = render('Broken [@id, title: "unclosed] for more.');
    expect(html).not.toContain('entry=');
  });

  it('falls through to text on two positional values', function () {
    // Two positionals are rejected by the grammar; user can quote
    // the whole locator if they need both pieces.
    const html = render('See [@id, p. 20, sec. 3].');
    expect(html).not.toContain('entry=');
  });

  it('does not match a regular markdown link', function () {
    const html = render('Just [a link](https://example.com) here.');
    expect(html).not.toContain('entry=');
    // The regular link should still render.
    expect(html).toContain('href="https://example.com"');
  });

  it('does not match a bare bracketed word', function () {
    const html = render('Just [word] in text.');
    expect(html).not.toContain('entry=');
  });
});
