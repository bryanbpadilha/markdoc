// src/tokenizer/math.ts

export default function customMathPlugin(md: any) {
  // 1. Block Math Parser ($$ ... $$)
  md.block.ruler.before('fence', 'math_block', (state: any, start: number, end: number, silent: boolean) => {
    const startPos = state.bMarks[start] + state.tShift[start];
    
    // Check if line starts with $$
    if (!state.src.startsWith('$$', startPos)) return false;
    if (silent) return true;

    let nextLine = start;
    let closed = false;
    
    // Scan subsequent lines for the closing $$
    while (++nextLine < end) {
      const pos = state.bMarks[nextLine] + state.tShift[nextLine];
      if (state.src.startsWith('$$', pos)) {
        closed = true;
        break;
      }
    }

    if (!closed) return false;

    // Push the block token to the AST
    const token = state.push('math_block', 'math', 0);
    const formula = state.getLines(start + 1, nextLine, state.tShift[start], false);
    
    token.block = true;
    token.content = formula;
    token.attrSet('content', formula);

    state.line = nextLine + 1;
    return true;
  });

  // 2. Inline Math Parser ($ ... $)
  md.inline.ruler.before('escape', 'math_inline', (state: any, silent: boolean) => {
    // Check for opening $
    if (state.src[state.pos] !== '$') return false;
    
    // Prevent matching $$ in the inline parser
    if (state.src[state.pos + 1] === '$') return false; 

    const start = state.pos + 1;
    let match = start;
    
    // Scan characters for the closing $
    while ((match = state.src.indexOf('$', match)) !== -1) {
      // Ignore escaped dollars (\$)
      if (state.src[match - 1] === '\\') {
        match++;
        continue;
      }
      break;
    }

    if (match === -1) return false;

    if (!silent) {
      // Push the inline token to the AST
      const token = state.push('math_inline', 'math', 0);
      const formula = state.src.slice(start, match);
      
      token.content = formula;
      token.attrSet('content', formula)
    }

    state.pos = match + 1;
    return true;
  });
}