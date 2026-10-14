"use client";

import React from "react";
import { usePrivy } from "@privy-io/react-auth";

export default function HomePage() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem",
        maxWidth: "600px",
        margin: "0 auto"
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem"
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Microcosm</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Arc Consumer Payments
          </p>
        </div>
        <div>
          {ready &&
            (authenticated ? (
              <button
                type="button"
                onClick={() => logout()}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  background: "var(--surface)",
                  border: "1px solid var(--surface-border)",
                  color: "var(--text)",
                  cursor: "pointer"
                }}
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => login()}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  background: "var(--primary)",
                  border: "none",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Sign in
              </button>
            ))}
        </div>
      </header>

      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--surface-border)",
          borderRadius: "12px",
          padding: "1.5rem",
          marginBottom: "1.5rem"
        }}
      >
        <h2 style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>
          Personal Space
        </h2>
        {authenticated ? (
          <div>
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "0.875rem",
                marginBottom: "1rem"
              }}
            >
              Logged in as {user?.email?.address || user?.id || "Microcosm User"}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem"
              }}
            >
              <div
                style={{
                  background: "var(--bg)",
                  padding: "1rem",
                  borderRadius: "8px",
                  border: "1px solid var(--surface-border)"
                }}
              >
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Arc USDC Balance
                </span>
                <p
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    marginTop: "0.25rem"
                  }}
                >
                  0.00 USDC
                </p>
              </div>
              <div
                style={{
                  background: "var(--bg)",
                  padding: "1rem",
                  borderRadius: "8px",
                  border: "1px solid var(--surface-border)"
                }}
              >
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Network
                </span>
                <p
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    marginTop: "0.25rem"
                  }}
                >
                  Arc Mainnet
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Connect to access your recoverable identity and personal financial
            space.
          </p>
        )}
      </section>
    </main>
  );
}
