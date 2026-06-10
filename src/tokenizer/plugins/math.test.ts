import Tokenizer from '..';

describe('MarkdownIt custom math plugin', function () {
  const tokenizer = new Tokenizer();

  function parse(example: string) {
    const content = example.replace(/\n\s+/gm, '\n').trim();
    return tokenizer.tokenize(content);
  }

  it('parsing basic block math', function () {
    const example = parse(`
    $$
    E = mc^2
    $$
    `);

    expect(example.length).toEqual(1);
    expect(example[0]).toDeepEqualSubset({
      type: 'math_block',
      content: 'E = mc^2',
      block: true,
    });
  });

  it('parsing multiline block math', function () {
    const example = parse(`
    $$
    a^2 + b^2 = c^2
    x = y + 1
    $$
    `);

    expect(example.length).toEqual(1);
    expect(example[0]).toDeepEqualSubset({
      type: 'math_block',
      content: 'a^2 + b^2 = c^2\nx = y + 1',
      block: true,
    });
  });

  it('parsing inline math inside a paragraph', function () {
    const example = parse(`
    Here is an equation $x = 1$ in text.
    `);

    // In markdown-it, paragraph wraps an 'inline' token, which contains the actual parsed children.
    expect(example.length).toEqual(3); // paragraph_open, inline, paragraph_close
    expect(example[0].type).toEqual('paragraph_open');
    expect(example[1].type).toEqual('inline');
    
    const children = example[1].children;
    expect(children.length).toEqual(3); // text, math_inline, text
    expect(children[1]).toDeepEqualSubset({
      type: 'math_inline',
      content: 'x = 1',
    });
  });

  it('missing closing block delimiter', function () {
    const example = parse(`
    $$
    E = mc^2
    
    # Test
    `);

    // Without a closing $$, it should fall back to parsing it as standard markdown text/paragraphs.
    expect(example[0].type).toEqual('paragraph_open');
    expect(example[1].content).toContain('$$');
  });

  it('missing closing inline delimiter', function () {
    const example = parse(`
    The total is $100 today.
    `);

    const children = example[1].children;
    // Should parse as a single raw text node, not math
    expect(children.length).toEqual(1);
    expect(children[0].type).toEqual('text');
    expect(children[0].content).toContain('$100');
  });

  it('ignores escaped dollar signs', function () {
    const example = parse(`
    Cost is \\$50 and not math.
    `);

    const children = example[1].children;
    expect(children.length).toEqual(1);
    expect(children[0].type).toEqual('text');
    
    // Ensure no math_inline token was accidentally generated
    const hasMath = children.some((token: any) => token.type === 'math_inline');
    expect(hasMath).toBeFalse();
  });
});