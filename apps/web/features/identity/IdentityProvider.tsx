"use client";

import React, { createContext, useContext } from "react";
import { useMicrocosmSession, type MicrocosmSessionState } from "./useMicrocosmSession.ts";

const MicrocosmSessionContext = createContext<MicrocosmSessionState | null>(null);

export const MicrocosmSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = useMicrocosmSession();

  return (
    <MicrocosmSessionContext.Provider value={session}>
      {children}
    </MicrocosmSessionContext.Provider>
  );
};

export const useSession = (): MicrocosmSessionState => {
  const ctx = useContext(MicrocosmSessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a MicrocosmSessionProvider");
  }
  return ctx;
};
