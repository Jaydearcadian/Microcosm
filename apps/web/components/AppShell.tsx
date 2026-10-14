"use client";

import React from "react";
import { SidebarNavigation } from "./SidebarNavigation.tsx";
import { BottomNavigation } from "./BottomNavigation.tsx";

type AppShellProps = {
  children: React.ReactNode;
  activeSpaceName?: string;
  principalHandle?: string;
  activeRoute?: string;
};

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeSpaceName,
  principalHandle
}) => {
  return (
    <div className="app-container">
      <SidebarNavigation
        activeSpaceName={activeSpaceName}
        principalHandle={principalHandle}
      />
      <main className="main-content">{children}</main>
      <BottomNavigation />
    </div>
  );
};
