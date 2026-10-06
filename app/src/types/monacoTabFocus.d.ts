// Monaco keeps "Tab moves focus" (toggled with Ctrl+M) in this internal singleton; the
// public editor option `tabFocusMode` does not follow the toggle (monaco-editor 0.52).
declare module 'monaco-editor/esm/vs/editor/browser/config/tabFocus.js' {
  export const TabFocus: { getTabFocusMode(): boolean };
}
