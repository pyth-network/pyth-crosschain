declare module "*.svg" {
  // biome-ignore lint/suspicious/noExplicitAny: SVG module declaration requires any type
  const content: any;
  export default content;
}
