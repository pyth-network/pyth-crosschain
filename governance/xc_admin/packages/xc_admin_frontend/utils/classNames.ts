// biome-ignore lint/suspicious/noExplicitAny: Utility function accepts any class name types
export const classNames = (...classes: any) => {
  return classes.filter(Boolean).join(" ");
};
