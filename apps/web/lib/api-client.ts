import type {
  MeResponse,
  BalanceResponse,
  Recipient,
  CreateRecipientRequest,
  PreparePaymentResponse,
  ActivityItem
} from "@mcosm/api-contracts";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

export type ApiClientConfig = {
  baseUrl?: string;
  getAccessToken?: () => Promise<string | null> | string | null;
  getSpaceId?: () => string | null | undefined;
  onUnauthorized?: () => void;
};

export const createApiClient = (config: ApiClientConfig = {}) => {
  const baseUrl = config.baseUrl || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3000";

  const request = async <T>(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
      idempotencyKey?: string;
    } = {}
  ): Promise<T> => {
    const token = config.getAccessToken ? await config.getAccessToken() : null;
    const spaceId = config.getSpaceId ? config.getSpaceId() : null;

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...options.headers
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (spaceId) {
      headers["x-space-id"] = spaceId;
    }

    if (options.idempotencyKey) {
      headers["idempotency-key"] = options.idempotencyKey;
    }

    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    const url = `${baseUrl.replace(/\/+$/, "")}${endpoint}`;
    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (response.status === 401) {
      config.onUnauthorized?.();
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const code = payload?.code || payload?.error || "unknown_error";
      const message = payload?.message || `API request failed with status ${response.status}`;
      const requestId = payload?.requestId;
      throw new ApiClientError(response.status, String(code), String(message), requestId, payload);
    }

    return payload as T;
  };

  return {
    async getMe(): Promise<MeResponse> {
      return request<MeResponse>("/v1/me");
    },

    async getBalance(asset: string = "USDC"): Promise<BalanceResponse> {
      return request<BalanceResponse>(`/v1/balance?asset=${encodeURIComponent(asset)}`);
    },

    async listSpaces(): Promise<{ spaces: any[] }> {
      return request<{ spaces: any[] }>("/v1/spaces");
    },

    async listRecipients(): Promise<Recipient[]> {
      return request<Recipient[]>("/v1/recipients");
    },

    async createRecipient(input: Partial<CreateRecipientRequest>): Promise<{ recipient: Recipient }> {
      return request<{ recipient: Recipient }>("/v1/recipients", {
        method: "POST",
        body: input
      });
    },

    async listEnvelopes(): Promise<any[]> {
      return request<any[]>("/v1/envelopes");
    },

    async createEnvelope(input: Record<string, unknown>): Promise<any> {
      return request<any>("/v1/envelopes", {
        method: "POST",
        body: input
      });
    },

    async listIntents(): Promise<any[]> {
      return request<any[]>("/v1/intents");
    },

    async createIntent(input: Record<string, unknown>, idempotencyKey?: string): Promise<{ intent: any; evaluation?: any }> {
      return request<{ intent: any; evaluation?: any }>("/v1/intents", {
        method: "POST",
        body: input,
        idempotencyKey
      });
    },

    async preparePayment(intentId: string): Promise<PreparePaymentResponse> {
      return request<PreparePaymentResponse>("/v1/payments/prepare", {
        method: "POST",
        body: { intentId }
      });
    },

    async submitPayment(input: {
      paymentId?: string;
      intentId?: string;
      txHash: string;
      chainId?: number;
      senderAddress?: string;
    }, idempotencyKey?: string): Promise<{ ok: boolean; submission: any }> {
      const endpoint = input.paymentId
        ? `/v1/payments/${encodeURIComponent(input.paymentId)}/submission`
        : "/v1/payments/submission";
      return request<{ ok: boolean; submission: any }>(endpoint, {
        method: "POST",
        body: input,
        idempotencyKey
      });
    },

    async confirmPayment(paymentId: string): Promise<{ ok: boolean; payment: any }> {
      return request<{ ok: boolean; payment: any }>(`/v1/payments/${encodeURIComponent(paymentId)}/confirm`, {
        method: "POST"
      });
    },

    async getPayment(paymentId: string): Promise<any> {
      return request<any>(`/v1/payments/${encodeURIComponent(paymentId)}`);
    },

    async listActivity(): Promise<{ items: ActivityItem[]; nextCursor?: string | null }> {
      const res = await request<any>("/v1/activity");
      if (Array.isArray(res)) {
        return { items: res };
      }
      return res;
    },

    async requestWalletChallenge(address: string): Promise<{ challenge: { id: string; address: string; message: string; expiresAt: string } }> {
      return request<{ challenge: { id: string; address: string; message: string; expiresAt: string } }>("/v1/wallet/challenge", {
        method: "POST",
        body: { address }
      });
    },

    async linkWallet(challengeId: string, signature: string): Promise<{ ok: boolean; wallet: any }> {
      return request<{ ok: boolean; wallet: any }>("/v1/wallet/link", {
        method: "POST",
        body: { challengeId, signature }
      });
    }
  };
};

export type ApiClient = ReturnType<typeof createApiClient>;
