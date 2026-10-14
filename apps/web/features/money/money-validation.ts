export const isEvmAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
};

export const isValidDecimalAmount = (amountStr: string): boolean => {
  const trimmed = amountStr.trim();
  if (!trimmed) return false;
  // Match 1 to 6 decimal digits, non-negative, no exponents or NaN
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    return false;
  }
  try {
    const units = parseUsdcToBaseUnits(trimmed);
    return units > 0n;
  } catch {
    return false;
  }
};

export const parseUsdcToBaseUnits = (amountStr: string): bigint => {
  const trimmed = amountStr.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("Invalid USDC amount. Must be a positive decimal string with at most 6 decimal places.");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const paddedFraction = fraction.padEnd(6, "0");
  return BigInt(whole!) * 1_000_000n + BigInt(paddedFraction);
};

export const formatBaseUnitsToUsdc = (baseUnits: bigint): string => {
  const whole = baseUnits / 1_000_000n;
  const fraction = baseUnits % 1_000_000n;
  const fractionStr = fraction.toString().padStart(6, "0");
  return `${whole}.${fractionStr}`;
};

export type SendFormValidation = {
  isValid: boolean;
  errors: {
    recipient?: string;
    amount?: string;
  };
};

export const validateSendForm = (
  recipient: string,
  amount: string,
  availableBalanceBaseUnits?: bigint
): SendFormValidation => {
  const errors: SendFormValidation["errors"] = {};

  if (!recipient.trim()) {
    errors.recipient = "Recipient address is required";
  } else if (!isEvmAddress(recipient) && !recipient.startsWith("rcp_")) {
    errors.recipient = "Must be a valid 42-character 0x EVM address or recipient ID";
  }

  if (!amount.trim()) {
    errors.amount = "Amount is required";
  } else if (!isValidDecimalAmount(amount)) {
    errors.amount = "Amount must be a positive number with at most 6 decimal places";
  } else if (availableBalanceBaseUnits !== undefined) {
    try {
      const requestedUnits = parseUsdcToBaseUnits(amount);
      if (requestedUnits > availableBalanceBaseUnits) {
        errors.amount = "Insufficient Arc USDC balance";
      }
    } catch {
      errors.amount = "Invalid amount";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const parseUsdcBaseUnits = (
  amountStr: string
): {
  valid: boolean;
  baseUnits?: bigint;
  humanFormatted?: string;
  error?: string;
} => {
  try {
    const baseUnits = parseUsdcToBaseUnits(amountStr);
    return {
      valid: true,
      baseUnits,
      humanFormatted: formatBaseUnitsToUsdc(baseUnits)
    };
  } catch (err: unknown) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Invalid amount"
    };
  }
};

export const isValidRecipientFormat = (
  recipient: string
): {
  valid: boolean;
  type: "address" | "email" | null;
} => {
  const trimmed = recipient.trim();
  if (isEvmAddress(trimmed)) {
    return { valid: true, type: "address" };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: true, type: "email" };
  }
  return { valid: false, type: null };
};

