// Side-effect and asset imports handled by the bundler.
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: string;
  export default content;
}
