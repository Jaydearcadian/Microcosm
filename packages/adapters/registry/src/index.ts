import {
  createAlliumAdapter,
  type AlliumAdapter
} from "../../allium/src/index.ts";
import { arcAdapter } from "../../arc/src/index.ts";
import { hyperliquidAdapter } from "../../hyperliquid/src/index.ts";
import { lighterAdapter } from "../../lighter/src/index.ts";
import { myriadAdapter } from "../../myriad/src/index.ts";
import { polymarketAdapter } from "../../polymarket/src/index.ts";
import { uniblockAdapter } from "../../uniblock/src/index.ts";
import { createXmtpAdapter, type XmtpAdapter } from "../../xmtp/src/index.ts";
import { createPrivyAdapter, type PrivyAdapter } from "../../privy/src/index.ts";

export type CreateAdapterRegistryInput = {
  privy?: {
    appId?: string;
    appSecret?: string;
    apiUrl?: string;
  };
  xmtp?: {
    env?: "local" | "dev" | "production" | "testnet-staging" | "testnet-dev" | "testnet" | "mainnet";
    dbPath?: string | null;
    apiUrl?: string;
    historySyncUrl?: string | null;
  };
  allium?: {
    apiKey?: string;
    apiUrl?: string;
  };
};

export type AdapterRegistry = {
  settlement: {
    arc: typeof arcAdapter;
  };
  identity: {
    privy: PrivyAdapter | ReturnType<typeof createStaticPrivyDescriptor>;
  };
  communications: {
    xmtp: XmtpAdapter | ReturnType<typeof createStaticXmtpDescriptor>;
  };
  data: {
    allium: AlliumAdapter | ReturnType<typeof createStaticAlliumDescriptor>;
    uniblock: typeof uniblockAdapter;
  };
  marketData: {
    firstClassVenues: readonly ["myriad", "polymarket"];
    customVenues: readonly ["hyperliquid", "lighter"];
    myriad: typeof myriadAdapter;
    polymarket: typeof polymarketAdapter;
    hyperliquid: typeof hyperliquidAdapter;
    lighter: typeof lighterAdapter;
  };
};

const createStaticPrivyDescriptor = () => ({
  id: "privy",
  kind: "identity",
  capabilities: [
    "embedded-wallets",
    "wallet-pregeneration",
    "server-wallets",
    "linked-identities"
  ] as const
});

const createStaticXmtpDescriptor = () => ({
  id: "xmtp",
  kind: "communications",
  capabilities: [
    "agent-messaging",
    "recipient-notifications",
    "content-types"
  ] as const
});

const createStaticAlliumDescriptor = () => ({
  id: "allium",
  kind: "data",
  realtime: true,
  capabilities: [
    "wallets",
    "holdings",
    "prices",
    "historical",
    "streams"
  ] as const
});

export const createAdapterRegistry = (
  input: CreateAdapterRegistryInput = {}
): AdapterRegistry => ({
  settlement: {
    arc: arcAdapter
  },
  identity: {
    privy:
      input.privy?.appId && input.privy?.appSecret
        ? createPrivyAdapter(input.privy)
        : createStaticPrivyDescriptor()
  },
  communications: {
    xmtp: input.xmtp
      ? createXmtpAdapter(input.xmtp)
      : createStaticXmtpDescriptor()
  },
  data: {
    allium:
      input.allium?.apiKey
        ? createAlliumAdapter(input.allium)
        : createStaticAlliumDescriptor(),
    uniblock: uniblockAdapter
  },
  marketData: {
    firstClassVenues: ["myriad", "polymarket"] as const,
    customVenues: ["hyperliquid", "lighter"] as const,
    myriad: myriadAdapter,
    polymarket: polymarketAdapter,
    hyperliquid: hyperliquidAdapter,
    lighter: lighterAdapter
  }
});
