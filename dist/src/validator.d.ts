import type { Node, Config, SchemaAttribute, ValidateError, ValidationError, Value } from './types';
type TypeParam = NonNullable<SchemaAttribute['type']>;
export declare function validateType(type: TypeParam, value: Value, config: Config, key: string): boolean | ValidationError[];
export default function validator(node: Node, config: Config): ValidationError[] | Promise<ValidationError[]>;
export declare function walkWithParents(node: Node, parents?: Node[]): Generator<[Node, Node[]]>;
export declare function validateTree(content: Node, config: Config): Promise<ValidateError[]> | (ValidateError | Promise<ValidateError[]>)[];
export {};
//# sourceMappingURL=validator.d.ts.map