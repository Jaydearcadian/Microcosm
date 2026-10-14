import test from "node:test";
import assert from "node:assert/strict";
import {
  isEvmAddress,
  isValidDecimalAmount,
  parseUsdcToBaseUnits,
  formatBaseUnitsToUsdc,
  validateSendForm
} from "../features/money/money-validation.ts";

test("isEvmAddress validates hex addresses correctly", () => {
  assert.equal(isEvmAddress("0x3600000000000000000000000000000000000000"), true);
  assert.equal(isEvmAddress("0x1111111111111111111111111111111111111111"), true);
  assert.equal(isEvmAddress("0xinvalid"), false);
  assert.equal(isEvmAddress("0x1111"), false);
  assert.equal(isEvmAddress(""), false);
});

test("parseUsdcToBaseUnits converts decimal strings without float precision loss", () => {
  assert.equal(parseUsdcToBaseUnits("1"), 1_000_000n);
  assert.equal(parseUsdcToBaseUnits("1.5"), 1_500_000n);
  assert.equal(parseUsdcToBaseUnits("0.000001"), 1n);
  assert.equal(parseUsdcToBaseUnits("100.123456"), 100_123_456n);
  assert.equal(parseUsdcToBaseUnits("5000000"), 5_000_000_000_000n);

  // Reject invalid strings
  assert.throws(() => parseUsdcToBaseUnits("1.1234567")); // 7 decimals
  assert.throws(() => parseUsdcToBaseUnits("-5"));
  assert.throws(() => parseUsdcToBaseUnits("1e6"));
  assert.throws(() => parseUsdcToBaseUnits("abc"));
});

test("formatBaseUnitsToUsdc formats base units into 6-decimal string", () => {
  assert.equal(formatBaseUnitsToUsdc(1_000_000n), "1.000000");
  assert.equal(formatBaseUnitsToUsdc(1_500_000n), "1.500000");
  assert.equal(formatBaseUnitsToUsdc(1n), "0.000001");
});

test("validateSendForm enforces recipient, decimal amount, and balance bounds", () => {
  // Valid
  const valid = validateSendForm(
    "0x1111111111111111111111111111111111111111",
    "25.50",
    100_000_000n // 100 USDC balance
  );
  assert.equal(valid.isValid, true);
  assert.deepEqual(valid.errors, {});

  // Over-balance
  const overBalance = validateSendForm(
    "0x1111111111111111111111111111111111111111",
    "150.00",
    100_000_000n
  );
  assert.equal(overBalance.isValid, false);
  assert.equal(overBalance.errors.amount, "Insufficient Arc USDC balance");

  // Invalid recipient
  const badRecipient = validateSendForm("not-an-address", "10");
  assert.equal(badRecipient.isValid, false);
  assert.match(badRecipient.errors.recipient ?? "", /valid/i);

  // Invalid amount format
  const badAmount = validateSendForm("0x1111111111111111111111111111111111111111", "0");
  assert.equal(badAmount.isValid, false);
});
