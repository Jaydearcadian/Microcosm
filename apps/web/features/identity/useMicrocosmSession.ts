"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { MeResponse, UserSummary, Space, WalletBinding } from "@mcosm/api-contracts";
import { createApiClient, ApiClientError } from "../../lib/api-client.ts";

export type MicrocosmSessionState = {
  ready: boolean;
  authenticated: boolean;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
  user: UserSummary | null;
  principal: UserSummary | null;
  activeSpace: Space | null;
  wallets: WalletBinding[];
  identities: MeResponse["identities"];
  privyUser: ReturnType<typeof usePrivy>["user"];
  getAccessToken: () => Promise<string | null>;
  login: () => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

export const useMicrocosmSession = (): MicrocosmSessionState => {
  const { ready, authenticated, user: privyUser, login, logout: privyLogout, getAccessToken } = usePrivy();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiClient = useMemo(() => {
    return createApiClient({
      getAccessToken: async () => {
        if (!authenticated) return null;
        try {
          return await getAccessToken();
        } catch {
          return null;
        }
      },
      onUnauthorized: () => {
        setSessionData(null);
        setError("Session expired. Please sign in again.");
      }
    });
  }, [authenticated, getAccessToken]);

  const fetchSession = useCallback(async () => {
    if (!ready || !authenticated) {
      setSessionData(null);
      setAccessToken(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      setAccessToken(token);
      const me = await apiClient.getMe();
      setSessionData(me);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load session");
      }
      setSessionData(null);
    } finally {
      setLoading(false);
    }
  }, [ready, authenticated, getAccessToken, apiClient]);

  useEffect(() => {
    if (ready && authenticated) {
      void fetchSession();
    } else {
      setSessionData(null);
      setAccessToken(null);
      setLoading(false);
    }
  }, [ready, authenticated, fetchSession]);

  const logout = useCallback(async () => {
    setSessionData(null);
    setAccessToken(null);
    setError(null);
    await privyLogout();
  }, [privyLogout]);

  return {
    ready,
    authenticated,
    accessToken,
    loading,
    error,
    user: sessionData?.user ?? null,
    principal: sessionData?.user ?? null,
    activeSpace: sessionData?.activeSpace ?? null,
    wallets: sessionData?.wallets ?? [],
    identities: sessionData?.identities ?? [],
    privyUser,
    getAccessToken: async () => {
      if (!authenticated) return null;
      try {
        return await getAccessToken();
      } catch {
        return null;
      }
    },
    login,
    logout,
    refreshSession: fetchSession
  };
};
