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

export const BottomNavigation: React.FC = () => {
  const pathname = usePathname() || "/";

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
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
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              padding: "8px 12px",
              color: active ? "var(--primary)" : "var(--text-muted)",
              transition: "color var(--transition-fast)",
              position: "relative"
            }}
          >
            <Icon size={22} color={active ? "var(--primary)" : "var(--text-muted)"} />
            <span style={{ fontSize: "11px", fontWeight: active ? 600 : 500 }}>
              {item.label}
            </span>
            {active && (
              <span
                style={{
                  position: "absolute",
                  bottom: "2px",
                  width: "16px",
                  height: "2px",
                  borderRadius: "2px",
                  background: "var(--primary)"
                }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
};
