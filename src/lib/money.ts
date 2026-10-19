import { brand } from "@/config/brand";

 /**
  * Formats an amount using the store currency config.
  * Accepts number or numeric string (Prisma Decimal -> string/number).
  * Example (MMK): 45000 -> "45,000 Ks"
  */

export function formatMoney(amount: number | string): string {
    const { symbol, position, decimals } = brand.currency;
    const value = typeof amount === "string" ? Number(amount) : amount;
    const formatted = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals, 
    }).format(value);

    return position === "prefix" ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
}