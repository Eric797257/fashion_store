/** "Free over X" is judged on the goods total after the discount. */
export function shippingFeeFor(
  rate: { fee: number; freeShippingOver: number | null },
  goodsAfterDiscount: number,
): { fee: number; free: boolean } {
  const thresholdMet = rate.freeShippingOver !== null && goodsAfterDiscount >= rate.freeShippingOver;
  if (thresholdMet || rate.fee === 0) return { fee: 0, free: true };
  return { fee: rate.fee, free: false };
}