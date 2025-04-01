import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shortenAddress(address: string | undefined, chars = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 2) return address; // No need to shorten if already short
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
}

/**
 * Formats a number into an approximate string representation with suffixes (K, M, B, T).
 * Handles large numbers and provides reasonable precision for smaller numbers.
 * 
 * @param value The number to format (can be string or number).
 * @param maxDecimals Maximum decimal places for numbers < 1000.
 * @returns The formatted string (e.g., "1.23K", "45.6M", "789.1", "0.123"). Returns "0" if input is invalid.
 */
export function formatApproximateValue(value: string | number | null | undefined, maxDecimals = 3): string {
  if (value === null || value === undefined) return "0";

  let num: number;
  if (typeof value === 'string') {
    num = parseFloat(value);
    if (isNaN(num)) return "0"; 
  } else {
    num = value;
  }

  if (num === 0) return "0";

  const absNum = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (absNum < 0.0001) { // Handle very small numbers
    return num.toExponential(2); // Use scientific notation for very small decimals
  } 
  
  if (absNum < 1) { // Handle numbers between 0.0001 and 1
      return sign + absNum.toFixed(maxDecimals).replace(/\.?0+$/, ""); // Show decimals, remove trailing zeros
  }
  
  if (absNum < 1000) { // Numbers less than 1000, show decimals if needed
    return sign + absNum.toFixed(maxDecimals).replace(/\.0+$/, ""); // Remove .000 if no decimals
  }

  const tier = Math.floor(Math.log10(absNum) / 3);

  // If tier is invalid (e.g., due to very large numbers beyond reasonable formatting)
  if (tier === 0) return sign + absNum.toFixed(1); // Fallback for numbers just below 1000
  if (tier >= 5) return num.toExponential(2); // Use scientific notation for very large numbers (Quadrillion+)
  
  const suffix = ['', 'K', 'M', 'B', 'T'][tier];
  const scale = Math.pow(10, tier * 3);
  const scaled = absNum / scale;

  // Determine decimal places based on the scaled value
  let formattedScaled: string;
  if (scaled < 10) {
      formattedScaled = scaled.toFixed(2);
  } else if (scaled < 100) {
      formattedScaled = scaled.toFixed(1);
  } else {
      formattedScaled = scaled.toFixed(0);
  }
  
  // Remove trailing .0 or .00
  formattedScaled = formattedScaled.replace(/\.0+$/, ""); 

  return sign + formattedScaled + suffix;
}
