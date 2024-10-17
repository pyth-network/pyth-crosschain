import type {
  ComponentProps,
  ComponentType,
  SVGProps,
  JSXElementConstructor,
} from "react";

export type Icon = ComponentType<SVGProps<SVGSVGElement>>;
export type ExtendComponentProps<
  Component extends JSXElementConstructor<object>,
  NewProps,
> = Omit<ComponentProps<Component>, keyof NewProps> & NewProps;
