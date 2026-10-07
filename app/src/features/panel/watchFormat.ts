// How the Watch panel shows a variable's bytes.

export const toHex = (value: number[]) => {
  if (!Array.isArray(value)) return '';
  return value.map(v => v.toString(16).toUpperCase().padStart(2, '0')).join(' ');
};

/** The bytes as characters ('.' for what cannot be shown), like a hex dump. */
export const toChar = (value: number[]) => {
  if (!Array.isArray(value)) return '';
  return value.map(v => (v < 32 || v > 126 ? '.' : String.fromCharCode(v))).join('');
};

/**
 * The decimal value, for what is a number: a word (3 bytes, two's complement, as SIC
 * arithmetic sees it) or a single byte. A longer area (a string of BYTEs, an array) has no
 * one decimal value: it was shown as e.g. 1.33e+21 for C'HELLO SIC'.
 */
export const toDecimal = (value: number[]) => {
  if (!Array.isArray(value)) return '';
  if (value.length === 1) return String(value[0]);
  if (value.length === 3) {
    const n = (value[0] << 16) | (value[1] << 8) | value[2];
    return String(n & 0x800000 ? n - 0x1000000 : n);
  }
  return '';
};

export const hexAddress = (address: number) =>
  '0x' + address.toString(16).toUpperCase().padStart(6, '0');
