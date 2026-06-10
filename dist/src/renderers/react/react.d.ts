import { RenderableTreeNodes } from '../../types';
import type { createElement, ComponentType, Fragment, ReactNode } from 'react';
type ReactShape = Readonly<{
    createElement: typeof createElement;
    Fragment: typeof Fragment;
}>;
type Component = ComponentType<any>;
declare function tagName(name: string, components: Record<string, Component> | ((string: string) => Component)): string | Component;
export type RenderOpts = {
    components?: Record<string, Component> | ((string: string) => Component);
    resolveTagName?: typeof tagName;
};
export default function dynamic(node: RenderableTreeNodes, React: ReactShape, { components, resolveTagName }?: RenderOpts): ReactNode;
export {};
//# sourceMappingURL=react.d.ts.map