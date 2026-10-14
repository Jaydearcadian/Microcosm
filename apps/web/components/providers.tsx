"use client";

import React from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { MicrocosmSessionProvider } from "../features/identity/IdentityProvider.tsx";

export function Providers({ children }: { children: React.ReactNode }) {
  const envAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appId =
    typeof envAppId === "string" && envAppId.length === 25
      ? envAppId
      : "clmockprivyapp00000000000";

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#3b82f6"
        }
      }}
    >
      <MicrocosmSessionProvider>{children}</MicrocosmSessionProvider>
    </PrivyProvider>
  );
}
