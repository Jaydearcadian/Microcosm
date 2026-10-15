import { z } from "zod";

// Base primitives
export const EvmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address");

export const TxHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash");

export const MoneyDecimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, "Amount must be a non-negative decimal string with at most 6 decimals");

export const MoneyBaseUnitsStringSchema = z
  .string()
  .regex(/^\d+$/, "Amount base units must be a non-negative integer string");

export const ChainIdSchema = z
  .number()
  .int()
  .positive("Chain ID must be a positive integer");

// Error envelope
export const ApiErrorDetailsSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.record(z.string(), z.unknown()).optional()
  });

export const ApiErrorSchema = z
  .object({
    error: z.union([z.string(), ApiErrorDetailsSchema]),
    code: z.string().optional(),
    message: z.string().optional(),
    requestId: z.string().optional(),
    detail: z.string().optional(),
    details: z.record(z.string(), z.unknown()).optional()
  });

// Identity & Space
export const UserStatusSchema = z.enum(["active", "suspended", "deletion_pending"]);

export const UserSummarySchema = z
  .object({
    id: z.string(),
    status: UserStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string()
  })
  .strict();

export const ExternalIdentityTypeSchema = z.enum([
  "email",
  "social",
  "passkey",
  "wallet",
  "other"
]);

export const ExternalIdentitySummarySchema = z
  .object({
    provider: z.literal("privy"),
    providerSubject: z.string(),
    identityType: ExternalIdentityTypeSchema,
    verifiedAt: z.string().optional(),
    linkedAt: z.string()
  })
  .strict();

export const WalletBindingRoleSchema = z.enum(["primary", "additional"]);
export const WalletBindingProviderSchema = z.enum(["privy", "external"]);
export const WalletBindingVerificationSchema = z.enum([
  "provider_attested",
  "signature_verified",
  "unverified"
]);
export const WalletBindingStatusSchema = z.enum(["active", "disconnected", "revoked"]);

export const WalletBindingSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    spaceId: z.string(),
    address: EvmAddressSchema,
    chainType: z.literal("evm"),
    chainId: ChainIdSchema,
    role: WalletBindingRoleSchema,
    provider: WalletBindingProviderSchema,
    verification: WalletBindingVerificationSchema,
    status: WalletBindingStatusSchema,
    createdAt: z.string()
  })
  .strict();

export const SpaceTypeSchema = z.enum(["personal", "shared"]);
export const SpaceStatusSchema = z.enum(["active", "suspended", "archived"]);
export const SpaceRoleSchema = z.enum(["owner", "admin", "operator", "member", "viewer"]);

export const SpaceSchema = z
  .object({
    id: z.string(),
    type: SpaceTypeSchema,
    name: z.string(),
    ownerUserId: z.string(),
    status: SpaceStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string()
  })
  .strict();

export const SpaceResponseSchema = z
  .object({
    space: SpaceSchema,
    role: SpaceRoleSchema.optional()
  })
  .strict();

export const WalletBindingResponseSchema = z
  .object({
    wallet: WalletBindingSchema.optional(),
    wallets: z.array(WalletBindingSchema).optional()
  })
  .strict();

export const MeResponseSchema = z
  .object({
    user: UserSummarySchema,
    identities: z.array(ExternalIdentitySummarySchema),
    wallets: z.array(WalletBindingSchema),
    activeSpace: SpaceSchema
  })
  .strict();

// Balance
export const BalanceResponseSchema = z
  .object({
    spaceId: z.string(),
    address: EvmAddressSchema,
    chainId: ChainIdSchema,
    asset: z.literal("USDC"),
    tokenAddress: EvmAddressSchema,
    amountDecimal: MoneyDecimalStringSchema,
    amountBaseUnits: MoneyBaseUnitsStringSchema,
    observedAt: z.string(),
    source: z.enum(["arc_rpc", "cached"])
  })
  .strict();

// Recipients / People
export const RecipientTypeSchema = z.enum(["wallet", "email", "handle", "agent"]);
export const RecipientStatusSchema = z.enum(["active", "archived"]);

export const RecipientSchema = z
  .object({
    id: z.string(),
    spaceId: z.string(),
    ownerUserId: z.string(),
    recipientType: RecipientTypeSchema,
    displayLabel: z.string(),
    address: EvmAddressSchema.optional(),
    status: RecipientStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string()
  })
  .strict();

export const CreateRecipientRequestSchema = z
  .object({
    spaceId: z.string(),
    recipientType: RecipientTypeSchema,
    displayLabel: z.string(),
    address: EvmAddressSchema.optional()
  })
  .strict();

export const RecipientResponseSchema = z
  .object({
    recipient: RecipientSchema
  })
  .strict();

// Intent
export const IntentStatusSchema = z.enum(["active", "consumed", "expired", "revoked"]);

export const IntentSchema = z
  .object({
    id: z.string(),
    spaceId: z.string(),
    ownerUserId: z.string(),
    recipientId: z.string(),
    recipientAddress: EvmAddressSchema,
    asset: z.literal("USDC"),
    tokenAddress: EvmAddressSchema,
    chainId: ChainIdSchema,
    amountDecimal: MoneyDecimalStringSchema,
    amountBaseUnits: MoneyBaseUnitsStringSchema,
    status: IntentStatusSchema,
    purposeMetadata: z.record(z.string(), z.unknown()).optional(),
    expiresAt: z.string(),
    createdAt: z.string()
  })
  .strict();

export const CreateIntentRequestSchema = z
  .object({
    spaceId: z.string(),
    recipientId: z.string(),
    recipientAddress: EvmAddressSchema,
    asset: z.literal("USDC"),
    tokenAddress: EvmAddressSchema,
    chainId: ChainIdSchema,
    amountDecimal: MoneyDecimalStringSchema,
    amountBaseUnits: MoneyBaseUnitsStringSchema,
    purposeMetadata: z.record(z.string(), z.unknown()).optional(),
    idempotencyKey: z.string()
  })
  .strict();

export const CreateIntentResponseSchema = z
  .object({
    intent: IntentSchema
  })
  .strict();

// Prepare payment
export const PreparePaymentRequestSchema = z
  .object({
    spaceId: z.string(),
    intentId: z.string()
  })
  .strict();

export const PreparePaymentResponseSchema = z
  .object({
    intentId: z.string(),
    senderAddress: EvmAddressSchema,
    to: EvmAddressSchema,
    calldata: z.string().regex(/^0x[a-fA-F0-9]*$/, "Calldata must be a valid hex string"),
    value: z.literal("0"),
    chainId: ChainIdSchema,
    tokenAddress: EvmAddressSchema,
    amountBaseUnits: MoneyBaseUnitsStringSchema,
    expiresAt: z.string(),
    // "direct": calldata is an ERC-20 transfer on the USDC contract.
    // "envelope": calldata is executePayment on the intent's ProgrammableEnvelope,
    // so policy (caps/schedule/allowlist) is enforced onchain before transfer.
    execution: z.enum(["direct", "envelope"]).optional(),
    envelopeAddress: EvmAddressSchema.optional()
  })
  .strict();

// Record submission
export const RecordSubmissionRequestSchema = z
  .object({
    spaceId: z.string(),
    intentId: z.string(),
    paymentId: z.string().optional(),
    txHash: TxHashSchema,
    senderAddress: EvmAddressSchema,
    chainId: ChainIdSchema
  })
  .strict();

// Payment state machine
export const PaymentStatusSchema = z.enum([
  "DRAFT",
  "VALIDATING",
  "READY_FOR_SIGNATURE",
  "SIGNATURE_REQUESTED",
  "SUBMITTED",
  "CONFIRMING",
  "CONFIRMED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
  "FAILED",
  "NEEDS_RECONCILIATION"
]);

export const PaymentSchema = z
  .object({
    id: z.string(),
    spaceId: z.string(),
    ownerUserId: z.string(),
    intentId: z.string(),
    senderAddress: EvmAddressSchema,
    recipientAddress: EvmAddressSchema,
    chainId: ChainIdSchema,
    tokenAddress: EvmAddressSchema,
    amountDecimal: MoneyDecimalStringSchema,
    amountBaseUnits: MoneyBaseUnitsStringSchema,
    status: PaymentStatusSchema,
    txHash: TxHashSchema.optional(),
    createdAt: z.string(),
    updatedAt: z.string()
  })
  .strict();

export const PaymentResponseSchema = z
  .object({
    payment: PaymentSchema
  })
  .strict();

// Activity
export const ActivityItemTypeSchema = z.enum([
  "payment_submitted",
  "payment_confirmed",
  "payment_failed",
  "wallet_linked",
  "recipient_added"
]);

export const ActivityItemSchema = z
  .object({
    id: z.string(),
    spaceId: z.string(),
    type: ActivityItemTypeSchema,
    title: z.string(),
    subtitle: z.string().optional(),
    timestamp: z.string(),
    status: z.string(),
    details: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

export const ActivityResponseSchema = z
  .object({
    items: z.array(ActivityItemSchema),
    nextCursor: z.string().nullable().optional()
  })
  .strict();

// Inferred TypeScript types
export type EvmAddress = z.infer<typeof EvmAddressSchema>;
export type TxHash = z.infer<typeof TxHashSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type UserSummary = z.infer<typeof UserSummarySchema>;
export type ExternalIdentitySummary = z.infer<typeof ExternalIdentitySummarySchema>;
export type WalletBinding = z.infer<typeof WalletBindingSchema>;
export type Space = z.infer<typeof SpaceSchema>;
export type SpaceResponse = z.infer<typeof SpaceResponseSchema>;
export type WalletBindingResponse = z.infer<typeof WalletBindingResponseSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
export type BalanceResponse = z.infer<typeof BalanceResponseSchema>;
export type Recipient = z.infer<typeof RecipientSchema>;
export type CreateRecipientRequest = z.infer<typeof CreateRecipientRequestSchema>;
export type RecipientResponse = z.infer<typeof RecipientResponseSchema>;
export type Intent = z.infer<typeof IntentSchema>;
export type CreateIntentRequest = z.infer<typeof CreateIntentRequestSchema>;
export type CreateIntentResponse = z.infer<typeof CreateIntentResponseSchema>;
export type PreparePaymentRequest = z.infer<typeof PreparePaymentRequestSchema>;
export type PreparePaymentResponse = z.infer<typeof PreparePaymentResponseSchema>;
export type RecordSubmissionRequest = z.infer<typeof RecordSubmissionRequestSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;
export type ActivityItem = z.infer<typeof ActivityItemSchema>;
export type ActivityResponse = z.infer<typeof ActivityResponseSchema>;
