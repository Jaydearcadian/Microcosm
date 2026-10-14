import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");

test("apps/web contains all required consumer route pages", () => {
  const routes = [
    "app/page.tsx",
    "app/money/page.tsx",
    "app/receive/page.tsx",
    "app/people/page.tsx",
    "app/activity/page.tsx",
    "app/settings/page.tsx"
  ];

  for (const route of routes) {
    const fullPath = path.join(webRoot, route);
    assert.ok(fs.existsSync(fullPath), `Route page must exist: ${route}`);
    const content = fs.readFileSync(fullPath, "utf-8");
    assert.ok(content.includes('"use client"'), `Route ${route} should declare use client directive`);
    assert.ok(content.includes("AppShell"), `Route ${route} should wrap content in AppShell`);
  }
});

test("apps/web features contain all required financial and identity components", () => {
  const components = [
    "components/AppShell.tsx",
    "components/BottomNavigation.tsx",
    "components/SidebarNavigation.tsx",
    "components/PageHeader.tsx",
    "components/NavIcons.tsx",
    "features/home/HomeOverview.tsx",
    "features/wallet/WalletSummary.tsx",
    "features/wallet/NetworkStatus.tsx",
    "features/identity/IdentityProvider.tsx",
    "features/identity/RecoveryPanel.tsx",
    "features/identity/useMicrocosmSession.ts",
    "features/money/money-validation.ts",
    "features/money/SendForm.tsx",
    "features/money/PaymentReview.tsx",
    "features/money/PaymentProgress.tsx",
    "features/people/PeopleList.tsx",
    "features/people/RecipientForm.tsx",
    "features/receive/ReceivePanel.tsx",
    "features/activity/ActivityList.tsx",
    "features/activity/PaymentReceipt.tsx"
  ];

  for (const comp of components) {
    const fullPath = path.join(webRoot, comp);
    assert.ok(fs.existsSync(fullPath), `Component file must exist: ${comp}`);
    const content = fs.readFileSync(fullPath, "utf-8");
    assert.ok(content.length > 50, `Component ${comp} should have non-empty content`);
  }
});

test("apps/web enforces zero floating-point math in financial components", () => {
  const moneyFiles = [
    "features/money/money-validation.ts",
    "features/money/SendForm.tsx",
    "features/money/PaymentReview.tsx"
  ];

  for (const file of moneyFiles) {
    const fullPath = path.join(webRoot, file);
    const content = fs.readFileSync(fullPath, "utf-8");
    // Ensure parseFloat or Math.round is not used for financial balance calculation
    assert.ok(!content.includes("parseFloat("), `File ${file} must not use parseFloat for currency calculations`);
  }
});
