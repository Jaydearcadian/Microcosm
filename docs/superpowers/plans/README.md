# Microcosm v0.1 Implementation Plan Index

Read and execute these plans in order:

1. [`2026-10-13-microcosm-v0.1-master.md`](./2026-10-13-microcosm-v0.1-master.md) — scope, dependencies and release gates.
2. [`2026-10-13-microcosm-identity-api.md`](./2026-10-13-microcosm-identity-api.md) — reproducible foundation, stable identity, personal Space, API authentication/authorization and durable persistence.
3. [`2026-10-13-microcosm-responsive-web.md`](./2026-10-13-microcosm-responsive-web.md) — mobile-first responsive consumer app.
4. [`2026-10-13-microcosm-arc-payment-release.md`](./2026-10-13-microcosm-arc-payment-release.md) — user-authorized Arc mainnet payment and release evidence.
5. [`2026-10-13-microcosm-v0-1-design-decisions.md`](./2026-10-13-microcosm-v0-1-design-decisions.md) — fixed choices, assumptions to verify, deferred work and kill criteria.

## Execution Rules

- Read `docs/MICROCOSM_PRD.md` and `docs/MICROCOSM_TECHNICAL_SPEC.md` before each plan.
- Read `docs/MICROCOSM_STATUS.md` and `docs/MICROCOSM_IMPLEMENTATION_MATRIX.md` before claiming a capability is already implemented.
- Use Superpowers TDD and review gates. A task is not complete until its test has been observed failing for the intended reason, passes after the minimal change, and the required regression suite passes.
- Do not start a dependent task while its predecessor's interface or acceptance gate is unresolved.
- Update status/evidence documents only after verification, not because a feature was planned or code was written.
- No live mainnet transaction without explicit user review of the exact transaction details and amount.
