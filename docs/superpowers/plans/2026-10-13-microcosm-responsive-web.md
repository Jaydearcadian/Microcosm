# Microcosm Responsive Consumer Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Use TDD for behavior, and verify responsive behavior in a real browser before release.

**Goal:** Build Microcosm's mobile-first consumer application with a persistent identity experience and responsive desktop expansion, backed by authenticated API contracts.

**Architecture:** Add `apps/web` as a Next.js/React TypeScript workspace. UI features call a typed API client and provider wallet APIs; they do not implement authoritative business policy or settlement. Reuse shared API schemas and existing package conventions. Use one responsive route system and navigation that changes presentation at breakpoints, not separate applications.

**Tech Stack:** Next.js, React, TypeScript, `@privy-io/react-auth`, viem, shared Zod API contracts, CSS modules or the repository's existing styling convention if a configured design system is discovered, Vitest/Testing Library for UI units and Playwright for browser acceptance only if installed/configured.

**Spec:** `docs/MICROCOSM_PRD.md` §§4, 6–10; `docs/MICROCOSM_TECHNICAL_SPEC.md` §§2–3, 5, 8–10, 14.

## Global Constraints

- Mobile-first responsive layout; desktop extends the same app, domain state and routes.
- Product language must describe identity, Spaces, people, money and activity simply; do not surface protocol jargon in primary user flows.
- Authentication, wallet authorization, ownership, balances and transaction status must come from provider/API/chain evidence, never fabricated client state.
- Client may validate forms for usability but the API independently validates every consequential request.
- Show explicit states for loading, empty, pending signature, user cancellation, submission, confirmation, failure and retry.
- Never put Privy app secret, database URL or server signing key in a client bundle.
- Do not show email/phone/wallet association as verified unless the relevant ownership proof has been completed.
- Do not add placeholder features for shared Spaces, agents, swaps, bridges or escrow to v0.1 navigation as if functional.


## Review Focus

1. Signing out, expiring a session or losing connectivity must not expose a stale authenticated view or claim a payment was submitted; covered in Tasks 3 and 5 tests.
2. A wallet on the wrong chain must be blocked before signature; covered in Tasks 4–5 network-state tests.
3. Invalid decimal precision or an over-balance amount must be blocked before wallet invocation; covered in Task 5 input tests.
4. A pending transaction, provider cancellation or RPC error must never be rendered as confirmed; covered in Tasks 5 and 7 state tests.
5. Small mobile widths and keyboard navigation must not hide actions or break form completion; covered in Tasks 2 and 8 responsive/browser checks.

## Task 1: Scaffold the Web Workspace

**Files:**
- Create: `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`, `apps/web/app/layout.tsx`, `apps/web/app/globals.css`, `apps/web/app/page.tsx`
- Modify: root `package-lock.json` and workspace configuration if necessary.

- [ ] Test project setup with a clean workspace install; capture existing lockfile failures from identity/API plan rather than suppressing them.
- [ ] Add the Next/React versions chosen by the technical spec only after checking current registry constraints, peer compatibility with `@privy-io/react-auth`, and Node version compatibility.
- [ ] Add a smoke test asserting app routes render and error if required public config is missing.
- [ ] Implement a minimal home route and shared layout, no financial behavior yet.
- [ ] Run `npm run typecheck` and web test command; run a production build; commit.

## Task 2: Define Responsive Navigation and Design Tokens

**Files:**
- Create: `apps/web/components/AppShell.tsx`, `apps/web/components/BottomNavigation.tsx`, `apps/web/components/SidebarNavigation.tsx`, `apps/web/components/PageHeader.tsx`, `apps/web/lib/navigation.ts`
- Create tests in `apps/web/tests/` for nav configuration and layout states.

**Interfaces:** navigation items are `home`, `money`, `people`, `activity`, `settings`; `space` is only shown when enabled and implemented. Use shared route names `/`, `/money`, `/people`, `/activity`, `/settings`.

- [ ] Test each primary route maps to one nav destination and the active destination is deterministic.
- [ ] Implement mobile bottom nav and desktop sidebar using CSS breakpoints; keep semantic links and keyboard focus.
- [ ] Add typography, spacing, border, surface and focus tokens without neon/crypto-casino styling.
- [ ] Verify 360px, 390px, tablet and desktop widths; no horizontal overflow or obscured primary action; commit.

## Task 3: Privy Authentication and Identity Recovery UI

**Files:**
- Create: `apps/web/app/(auth)/login/page.tsx`, `apps/web/app/(app)/layout.tsx`, `apps/web/features/identity/IdentityProvider.tsx`, `apps/web/features/identity/useMicrocosmSession.ts`, `apps/web/features/identity/RecoveryPanel.tsx`, `apps/web/lib/api-client.ts`
- Create tests for signed-out/signed-in/error states.

- [ ] Verify the exact installed Privy React APIs for login, linked accounts, wallet list and recovery/control configuration using the pinned SDK types/docs.
- [ ] Test unauthenticated route handling and API client behavior on 401/expired session.
- [ ] Implement login UI and session restoration; call `GET /v1/me` after session establishment.
- [ ] Display persistent Microcosm ID/profile separately from provider user ID and wallet address.
- [ ] Implement recovery/security settings using only provider-supported actions; clearly explain which actions recover login versus wallet access.
- [ ] Verify sign-out and recovery do not silently create duplicate internal users; commit.

## Task 4: Home and Live Wallet Read State

**Files:**
- Create: `apps/web/app/(app)/page.tsx`, `apps/web/features/home/HomeOverview.tsx`, `apps/web/features/wallet/WalletSummary.tsx`, `apps/web/features/wallet/NetworkStatus.tsx`, related tests.

- [ ] Test loading, zero balance, missing wallet, wrong network, RPC failure and successful response states.
- [ ] Implement Home from authenticated `/v1/me`, personal Space and wallet/balance endpoints. Use decimal strings; never calculate token values with floating-point money arithmetic.
- [ ] Show available actions based on actual wallet setup; no static placeholder balances or fake recent activity.
- [ ] Verify mobile and desktop rendering; commit.

## Task 5: Money Send Flow UI

**Files:**
- Create: `apps/web/app/(app)/money/page.tsx`, `apps/web/features/money/SendForm.tsx`, `apps/web/features/money/PaymentReview.tsx`, `apps/web/features/money/PaymentProgress.tsx`, `apps/web/features/money/money-validation.ts`, tests.

- [ ] Test invalid address, zero, negative, excess precision, too many fractional digits, over-balance, wrong chain and changed/stale intent.
- [ ] Build recipient, amount and purpose fields; show exact destination address and network on review.
- [ ] Call intent/prepare API and display the immutable prepared amount/token/recipient/chain before the wallet is invoked.
- [ ] Require explicit review and user action to invoke signing; cancellation returns to a safe editable state and creates no submitted transfer record.
- [ ] Prevent repeated clicks while signature/submission is in progress and reuse idempotency keys for retrying the same request.
- [ ] Connect only to settlement plan interfaces defined by the Arc plan; commit.

## Task 6: Receive and People

**Files:**
- Create: `apps/web/app/(app)/receive/page.tsx`, `apps/web/features/money/ReceivePanel.tsx`, `apps/web/features/people/PeopleList.tsx`, `apps/web/features/people/RecipientForm.tsx`, tests.

- [ ] Test network-qualified address display and copy behavior; ensure QR encodes only the intended address/network payload.
- [ ] Test invalid or unverified recipient metadata is never shown as verified.
- [ ] Implement receive address, copy address and QR, with explicit Arc network identity.
- [ ] Implement saved recipients only through authenticated API ownership checks; for v0.1 do not enable email escrow or publish raw email lookup keys onchain.
- [ ] Show whether a recipient's address was user-provided, wallet-verified or provider-resolved; commit.

## Task 7: Activity and Verifiable Payment Detail

**Files:**
- Create: `apps/web/app/(app)/activity/page.tsx`, `apps/web/app/(app)/activity/[paymentId]/page.tsx`, `apps/web/features/activity/ActivityList.tsx`, `apps/web/features/activity/PaymentReceipt.tsx`, tests.

- [ ] Test all payment states, unknown status, API failure and refresh during pending confirmation.
- [ ] Implement list/detail views using API response contracts; display transaction explorer link only for the configured network.
- [ ] Receipt UI differentiates intent, submitted transaction, confirmed receipt and failed/reverted transaction.
- [ ] Use API/chain-confirmed values only and make pending/unknown states prominent without implying settlement.
- [ ] Add copy/share receipt data without including authentication tokens or private identity fields; commit.

## Task 8: Settings, Recovery Status and Responsive QA

**Files:** `apps/web/app/(app)/settings/page.tsx`, identity/settings components and browser tests.

- [ ] Test linked methods, unavailable recovery path, wallet absent and provider error cases.
- [ ] Expose configured authentication methods, recovery options, wallet details and active network without leaking secret identifiers.
- [ ] Add a browser acceptance path: onboard → reload session → view balance → review send → cancel signature → return to Money without falsely creating a payment.
- [ ] Run lint/typecheck/unit tests and production build; run Playwright if available; check accessibility labels, keyboard path, reduced-motion preference and mobile overflow.
- [ ] Fresh reviewer checks user-facing claims against real provider/API capabilities; commit.

**Gate:** G2 from the master plan passes. The UI may be connected to test fixtures only in automated tests, and fixtures must be conspicuously test-only; the deployed app uses real API and chain data.
