"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActiveRoute } from "../lib/navigation.ts";
import {
  HomeIcon,
  MoneyIcon,
  PeopleIcon,
  ActivityIcon,
  SettingsIcon
} from "./NavIcons.tsx";

const iconMap = {
  home: HomeIcon,
  money: MoneyIcon,
  people: PeopleIcon,
  activity: ActivityIcon,
  settings: SettingsIcon
};

type SidebarProps = {
  activeSpaceName?: string;
  principalHandle?: string;
};

export const SidebarNavigation: React.FC<SidebarProps> = ({
  activeSpaceName = "Personal Space",
  principalHandle
}) => {
  const pathname = usePathname() || "/";

  return (
    <aside className="sidebar-nav" aria-label="Desktop sidebar">
      <div style={{ marginBottom: "2rem", padding: "0 0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              color: "#fff",
              fontSize: "16px"
            }}
          >
            M
          </div>
          <div>
            <span style={{ fontSize: "1.125rem", fontWeight: 700, letterSpacing: "-0.01em" }}>
              Microcosm
            </span>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
              Arc Financial Home
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "1.25rem",
            padding: "0.625rem 0.75rem",
            background: "var(--surface)",
            border: "1px solid var(--surface-border)",
            borderRadius: "var(--radius-md)"
          }}
        >
          <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Active Space
          </div>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", marginTop: "2px" }}>
            {activeSpaceName}
          </div>
          {principalHandle && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {principalHandle}
            </div>
          )}
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.id];
          const active = isActiveRoute(pathname, item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              aria-label={item.ariaLabel}
              aria-current={active ? "page" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "0.625rem 0.875rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.9375rem",
                fontWeight: active ? 600 : 500,
                color: active ? "#fff" : "var(--text-muted)",
                background: active ? "var(--surface-active)" : "transparent",
                border: active ? "1px solid var(--surface-border)" : "1px solid transparent",
                transition: "all var(--transition-fast)"
              }}
            >
              <Icon size={20} color={active ? "var(--primary)" : "var(--text-muted)"} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div style={{ paddingTop: "1rem", borderTop: "1px solid var(--surface-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--success)"
            }}
          />
          <span>Arc Mainnet (5042)</span>
        </div>
      </div>
    </aside>
  );
};
