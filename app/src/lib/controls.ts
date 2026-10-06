// One size per kind of control, so that controls of a kind look the same everywhere (see
// the screen layout section of app/README.md). Heights: bars 40 px (top) and 32 px (panel
// headers); controls in them 28 px; small icon buttons inside rows 24 px.

/** An icon button in a bar (file actions, run toolbar): 28 px square. */
export const BAR_ICON_BUTTON =
  'inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-gray-200 disabled:opacity-50';

/** A small icon button inside a row (close a tab, remove from a list): 24 px square. */
export const INLINE_ICON_BUTTON =
  'inline-flex size-6 shrink-0 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800';

/** A text field or a select: 28 px high. */
export const FORM_FIELD = 'h-7 rounded-md border border-gray-300 bg-white px-2';

/** A text button next to form fields: 28 px high. */
export const FORM_BUTTON =
  'inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-3 transition-colors hover:bg-gray-50';

/** A panel's header bar (Errors, Watch, Server): 32 px high. */
export const PANEL_HEADER =
  'flex h-8 shrink-0 items-center justify-between gap-2 border-b border-gray-300 px-2';
