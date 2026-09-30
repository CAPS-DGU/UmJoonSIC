const EXP_BITS = 15;
const EXP_BIAS = Math.pow(2, EXP_BITS - 1) - 1; // 16383
const ZERO = '0x000000000000';

/**
 * Format the F register as the 48-bit SIC/XE floating-point word:
 * 1 sign bit, 15 exponent bits (biased), 32 fraction bits.
 * `value` is the decimal string the simulator reports.
 */
export function toSicFloatHex(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) {
    return ZERO;
  }

  const sign = parsed < 0 ? 1 : 0;
  const magnitude = Math.abs(parsed);

  // Normalise: magnitude = 1.x * 2^exp
  let exp = Math.floor(Math.log2(magnitude));
  const mantissa = magnitude / Math.pow(2, exp); // 1 <= mantissa < 2
  const fraction = mantissa - 1; // [0, 1)

  // Round to a 32-bit fraction
  let fractionBits = Math.round(fraction * Math.pow(2, 32));
  if (fractionBits === Math.pow(2, 32)) {
    // Rounding carried into 1.000...: bump the exponent
    fractionBits = 0;
    exp += 1;
  }

  const biased = exp + EXP_BIAS;

  if (biased <= 0) {
    // Underflow is shown as zero
    return ZERO;
  }
  if (biased >= 1 << EXP_BITS) {
    // Overflow saturates at the largest finite value
    const maxBits = (BigInt(sign) << 47n) | (BigInt((1 << EXP_BITS) - 2) << 32n) | 0xffffffffn;
    return '0x' + maxBits.toString(16).toUpperCase().padStart(12, '0');
  }

  const bits = (BigInt(sign) << 47n) | (BigInt(biased) << 32n) | BigInt(fractionBits >>> 0);
  return '0x' + bits.toString(16).toUpperCase().padStart(12, '0');
}
