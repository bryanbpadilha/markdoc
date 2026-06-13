// End-to-end smoke test: parse text with the new `[@...]` citation
// syntax through the markdoc fork's pipeline and render to HTML. This
// mirrors what zetapedia's astro-markdoc integration does at build
// time, minus the Astro component resolution. The render target is
// `a` (an HTML tag) so we can see the actual produced attributes
// without needing to resolve cite.astro.

import Markdoc from './index.ts';

const config = {
  nodes: {
    cite: {
      render: 'a',
      attributes: {
        target: { type: String, render: 'entry' },
        locator: { type: String },
        prefix: { type: String },
        suffix: { type: String },
        kind: { type: String },
      },
    },
  },
};

const cases = [
  { name: 'bare cite', src: 'See [@koehler1937] for more.' },
  { name: 'positional locator', src: 'See [@koehler1937, p. 20] for more.' },
  { name: 'anchor', src: 'See [@entry, #section-3] for more.' },
  { name: 'explicit locator', src: 'See [@guy1999, locator: p. 20] for more.' },
  {
    name: 'multi-kwarg',
    src: 'See [@guy.com/hello, author: Guy, year: 2023, title: Hello World].',
  },
  {
    name: 'quoted value with comma',
    src: 'See [@id, title: "Hello, World"] for more.',
  },
  {
    name: 'quoted positional',
    src: 'See [@id, "p. 20, sec. 3"] for more.',
  },
  {
    name: 'prefix + locator',
    src: 'See [@guy1999, locator: p. 20, prefix: "see "] for more.',
  },
  { name: 'two adjacent', src: 'See [@a] and [@b, p. 20].' },
  { name: 'mixed with wikilink', src: 'See [[my-entry]] citing [@key, p. 20].' },
];

let failures = 0;
for (const c of cases) {
  try {
    const ast = Markdoc.parse(c.src);
    const transformed = Markdoc.transform(ast, config);
    const html = Markdoc.renderers.html(transformed);
    console.log(`\n=== ${c.name} ===`);
    console.log('src:', c.src);
    console.log('html:', html);
  } catch (e) {
    failures++;
    console.log(`\n=== ${c.name} ===`);
    console.log('src:', c.src);
    console.log('ERROR:', e.message);
  }
}

// Negative cases — these should fall through to plain text, not render
// a cite node.
const negativeCases = [
  { name: 'empty', src: 'Empty [@] here.' },
  { name: 'missing close', src: 'Incomplete [@koehler1937 here.' },
  { name: 'unclosed quote', src: 'Broken [@id, title: "unclosed] for more.' },
  { name: 'two positionals', src: 'See [@id, p. 20, sec. 3].' },
  { name: 'empty key', src: 'Broken [@id, : value] here.' },
  { name: 'plain markdown link', src: 'Just [a link](https://example.com) here.' },
  { name: 'plain bracketed', src: 'Just [word] in text.' },
];

for (const c of negativeCases) {
  try {
    const ast = Markdoc.parse(c.src);
    const transformed = Markdoc.transform(ast, config);
    const html = Markdoc.renderers.html(transformed);
    const hasCite = /entry="/.test(html);
    console.log(`\n=== NEG ${c.name} ===`);
    console.log('src:', c.src);
    console.log('html:', html);
    console.log(hasCite ? '  X cite found in output (should fall through)' : '  OK fell through to text');
    if (hasCite) failures++;
  } catch (e) {
    console.log(`\n=== NEG ${c.name} ===`);
    console.log('src:', c.src);
    console.log('ERROR:', e.message);
  }
}

process.exit(failures > 0 ? 1 : 0);
