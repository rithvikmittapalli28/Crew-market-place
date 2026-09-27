import { toPaise, fromPaise } from "./currency";

export const DEFAULT_PLATFORM_FEE_PERCENTAGE = 5.0; // 5% Crewn platform fee

export interface FeeCalculation {
  grossAmount: number;
  feePercentage: number;
  feeAmount: number;
  netFreelancerAmount: number;
  grossAmountPaise: number;
  feeAmountPaise: number;
  netAmountPaise: number;
}

/**
 * Calculates platform fee and net creator payout from gross milestone amount.
 * All math performed in integer paise to avoid rounding discrepancies.
 */
export function calculatePlatformFee(
  grossAmount: number | string,
  feePercentage: number = DEFAULT_PLATFORM_FEE_PERCENTAGE
): FeeCalculation {
  const grossAmountPaise = toPaise(grossAmount);
  // feeAmountPaise = Math.round((grossAmountPaise * feePercentage) / 100)
  const feeAmountPaise = Math.round((grossAmountPaise * feePercentage) / 100);
  const netAmountPaise = grossAmountPaise - feeAmountPaise;

  return {
    grossAmount: fromPaise(grossAmountPaise),
    feePercentage,
    feeAmount: fromPaise(feeAmountPaise),
    netFreelancerAmount: fromPaise(netAmountPaise),
    grossAmountPaise,
    feeAmountPaise,
    netAmountPaise,
  };
}
