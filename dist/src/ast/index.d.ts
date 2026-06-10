import Node from './node';
import Function from './function';
import Variable from './variable';
import type { AstType } from '../types';
declare function fromJSON(text: string): Node | Node[];
declare const _default: {
    fromJSON: typeof fromJSON;
    isAst(value?: any): value is AstType;
    isFunction(value?: any): value is import("../types").Function;
    isVariable(value?: any): value is import("../types").Variable;
    getAstValues(value: any): Generator<AstType, void, unknown>;
    resolve(value: any, config?: import("../types").Config): any;
    Function: typeof Function;
    Node: typeof Node;
    Variable: typeof Variable;
};
export default _default;
//# sourceMappingURL=index.d.ts.map