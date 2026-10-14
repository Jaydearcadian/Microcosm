"use client";

import React from "react";
import { AppShell } from "../components/AppShell.tsx";
import { HomeOverview } from "../features/home/HomeOverview.tsx";
import { useSession } from "../features/identity/IdentityProvider.tsx";

export default function HomePage() {
  const { user, activeSpace } = useSession();

  return (
    <AppShell
      activeSpaceName={activeSpace?.name || "Personal Space"}
      principalHandle={user?.id}
    >
      <HomeOverview />
    </AppShell>
  );
}
