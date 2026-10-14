import React from "react";

type NetworkStatusProps = {
  chainId?: number;
  networkName?: string;
  isOnline?: boolean;
};

export const NetworkStatus: React.FC<NetworkStatusProps> = ({
  chainId = 5042,
  networkName = "Arc Mainnet",
  isOnline = true
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1rem",
        background: "var(--bg)",
        border: "1px solid var(--surface-border)",
        borderRadius: "var(--radius-md)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: isOnline ? "var(--success)" : "var(--danger)"
          }}
          aria-hidden="true"
        />
        <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{networkName}</span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          ({chainId})
        </span>
      </div>

      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
        USDC: <code style={{ fontFamily: "var(--font-mono)" }}>0x3600...0000</code>
      </div>
    </div>
  );
};
