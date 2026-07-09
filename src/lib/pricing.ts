import { addCents, multiplyCents, percentOf, roundCents, type Cents } from './money';

export interface PricingItem {
  unitPriceCents: Cents;
  quantity: number;
  modifiersPriceDeltaCents?: Cents;
}

export interface OrderTotalsInput {
  items: PricingItem[];
  /** Tax rate as a percent (e.g. 8 = 8%). Applied to subtotal after discount. */
  taxRatePercent?: number;
  /** Whether the unit price already includes tax. */
  taxInclusive?: boolean;
  /** Percent discount applied to subtotal (0–100). */
  discountPercent?: number;
  /** Fixed discount in cents applied after percent discount. */
  discountFixedCents?: Cents;
  /** Service charge percent applied after discount, before tax. */
  serviceChargePercent?: number;
  /** Tip in cents. Added at the end. */
  tipCents?: Cents;
}

export interface OrderTotals {
  subtotalCents: Cents;
  discountCents: Cents;
  serviceChargeCents: Cents;
  taxCents: Cents;
  tipCents: Cents;
  grandTotalCents: Cents;
}

export function lineSubtotal(item: PricingItem): Cents {
  const unit = item.unitPriceCents + (item.modifiersPriceDeltaCents ?? 0);
  return multiplyCents(unit, item.quantity);
}

export function calculateTotals(input: OrderTotalsInput): OrderTotals {
  const subtotalCents = input.items.reduce((s, it) => s + lineSubtotal(it), 0);

  const percentDiscount = input.discountPercent
    ? percentOf(subtotalCents, input.discountPercent)
    : 0;
  const fixedDiscount = input.discountFixedCents ?? 0;
  const discountCents = Math.min(subtotalCents, percentDiscount + fixedDiscount);

  const afterDiscount = subtotalCents - discountCents;

  const serviceChargeCents = input.serviceChargePercent
    ? percentOf(afterDiscount, input.serviceChargePercent)
    : 0;

  let taxCents = 0;
  if (input.taxRatePercent) {
    if (input.taxInclusive) {
      // Extract tax from a tax-inclusive price.
      const rate = input.taxRatePercent / 100;
      taxCents = roundCents((afterDiscount * rate) / (1 + rate));
    } else {
      taxCents = percentOf(afterDiscount + serviceChargeCents, input.taxRatePercent);
    }
  }

  const tipCents = input.tipCents ?? 0;

  const grandTotalCents = input.taxInclusive
    ? addCents(afterDiscount, serviceChargeCents, tipCents)
    : addCents(afterDiscount, serviceChargeCents, taxCents, tipCents);

  return {
    subtotalCents,
    discountCents,
    serviceChargeCents,
    taxCents,
    tipCents,
    grandTotalCents,
  };
}
