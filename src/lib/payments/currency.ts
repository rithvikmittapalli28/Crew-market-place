import { Prisma } from "@prisma/client";

/**
 * Converts a decimal / currency amount to integer paise (1 INR = 100 paise).
 * Avoids JavaScript floating-point truncation (e.g. 19.99 * 100 -> 1998.999999).
 */
export function toPaise(amount: number | string | Prisma.Decimal): number {
  const str = typeof amount === "string" ? amount : amount.toString();
  const [whole, decimal = ""] = str.split(".");
  const paddedDecimal = (decimal + "00").slice(0, 2);
  const wholeInt = parseInt(whole, 10);
  const decimalInt = parseInt(paddedDecimal, 10);

  if (isNaN(wholeInt) || isNaN(decimalInt)) {
    throw new Error(`Invalid amount format for paise conversion: "${str}"`);
  }

  return wholeInt * 100 + decimalInt;
}

/**
 * Converts integer paise back to INR float / decimal representation.
 */
export function fromPaise(paise: number): number {
  return paise / 100;
}

/**
 * Formats a currency amount into standard INR display format (₹12,500.00).
 */
export function formatINR(amount: number | string | Prisma.Decimal): string {
  const num = typeof amount === "number" ? amount : parseFloat(amount.toString());
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
