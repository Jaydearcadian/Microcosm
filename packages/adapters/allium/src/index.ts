export type CreateAlliumAdapterInput = {
  apiKey?: string;
  apiUrl?: string;
};

export type AlliumRequest = {
  url: string;
  headers: Record<string, string>;
};

export type AlliumClient = {
  buildRequest: (path: string) => AlliumRequest;
  fetchJson: <T>(path: string, init?: RequestInit) => Promise<T>;
};

export type AlliumAdapter = {
  id: "allium";
  kind: "data";
  realtime: true;
  capabilities: readonly string[];
  config: {
    apiKey: string;
    apiUrl: string;
  };
  createClient: () => AlliumClient;
};

const CAPABILITIES = [
  "wallets",
  "holdings",
  "prices",
  "historical",
  "streams"
] as const;

export const createAlliumAdapter = ({
  apiKey,
  apiUrl
}: CreateAlliumAdapterInput): AlliumAdapter => {
  if (!apiKey) {
    throw new Error("Missing Allium API key");
  }

  const config = {
    apiKey,
    apiUrl: apiUrl ?? "https://api.allium.so"
  };

  return {
    id: "allium",
    kind: "data",
    realtime: true,
    capabilities: CAPABILITIES,
    config,
    createClient: () => ({
      buildRequest: (path) => ({
        url: new URL(path, config.apiUrl).toString(),
        headers: {
          Authorization: `Bearer ${config.apiKey}`
        }
      }),
      fetchJson: async <T>(path: string, init: RequestInit = {}) => {
        const request = new URL(path, config.apiUrl).toString();
        const response = await fetch(request, {
          ...init,
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            ...(init.headers ?? {})
          }
        });

        if (!response.ok) {
          throw new Error(`Allium request failed: ${response.status}`);
        }

        return (await response.json()) as T;
      }
    })
  };
};
