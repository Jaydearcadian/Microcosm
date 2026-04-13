import {
  createRuntimeConfig,
  type RuntimeConfig,
  type RuntimeConfigInput
} from "../../config/src/index.ts";
import {
  createAdapterRegistry,
  type AdapterRegistry
} from "../../adapters/registry/src/index.ts";
import {
  createPrivyAdapter,
  type PrivyAdapter
} from "../../adapters/privy/src/index.ts";
import {
  createXmtpAdapter,
  type XmtpAdapter
} from "../../adapters/xmtp/src/index.ts";
import {
  createAlliumAdapter,
  type AlliumAdapter
} from "../../adapters/allium/src/index.ts";
export { resolveRecipient } from "../../recipient-resolution/src/index.ts";
export { evaluateEnvelope } from "../../policy-engine/src/index.ts";
export { createJsonStateStore } from "../../persistence/src/index.ts";
export { createNotificationService } from "../../notifications/src/index.ts";

export { createRuntimeConfig } from "../../config/src/index.ts";
export { createAdapterRegistry } from "../../adapters/registry/src/index.ts";

export type MicrocosmClient = {
  config: RuntimeConfig;
  adapters: Omit<AdapterRegistry, "identity"> & {
    identity: {
      privy: PrivyAdapter;
    };
    communications: {
      xmtp: XmtpAdapter;
    };
    data: Omit<AdapterRegistry["data"], "allium"> & {
      allium: AlliumAdapter;
    };
  };
};

export const createClient = (
  env: RuntimeConfigInput = process.env
): MicrocosmClient => {
  const config = createRuntimeConfig(env);
  const privy = createPrivyAdapter({
    appId: config.identity.privyAppId,
    appSecret: config.identity.privyAppSecret,
    apiUrl: config.identity.privyApiUrl
  });
  const xmtp = createXmtpAdapter({
    env: config.communications.xmtpEnv as XmtpAdapter["config"]["env"],
    dbPath: config.communications.xmtpDbPath,
    apiUrl: config.communications.xmtpApiUrl,
    historySyncUrl: config.communications.xmtpHistorySyncUrl
  });
  const allium = createAlliumAdapter({
    apiKey: config.data.alliumApiKey,
    apiUrl: config.data.alliumApiUrl
  });
  const adapters = createAdapterRegistry();

  return {
    config,
    adapters: {
      ...adapters,
      identity: {
        privy
      },
      communications: {
        xmtp
      },
      data: {
        ...adapters.data,
        allium
      }
    }
  };
};
