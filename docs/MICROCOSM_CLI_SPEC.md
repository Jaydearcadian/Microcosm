# Microcosm CLI Specification

## 1. Purpose

The `mcosm` CLI is the command-line operating surface for Microcosm.

It exists to support:

- local development
- backend verification
- operations and incident response
- administrative workflows
- scripted automation
- developer onboarding and demos

It is not a second backend and not an alternative business-logic engine.

The CLI must remain:

- thin
- explicit
- composable
- safe for operator use
- stable enough for CI and scripts

The CLI should sit on top of the Microcosm SDK and API wherever possible. Direct local runtime access should be reserved for setup and maintenance commands only.

## 2. Primary Goals

The CLI should make these workflows easy:

1. boot and verify local runtime
2. inspect runtime health
3. resolve and claim recipients
4. create, inspect, and execute payments
5. inspect envelopes and policy evaluation
6. inspect notifications and settlements
7. manage database schema and local dev data

## 3. Non-Goals

The CLI should not:

- duplicate policy logic that belongs in the API
- implement settlement logic independently from the backend
- bypass authentication or authorization by default
- become the only way to administer the system
- expose raw private-key or signing workflows to users casually

## 4. User Personas

### 4.1 Backend developer

Needs:

- local runtime bootstrap
- health checks
- local test data creation
- endpoint exercise without writing ad hoc scripts

### 4.2 Operator

Needs:

- incident inspection
- settlement replay
- failed notification inspection
- recipient and claim support actions

### 4.3 Integrator developer

Needs:

- example flows
- predictable JSON output
- command discovery
- stable mapping to API concepts

### 4.4 Internal admin

Needs:

- payment lookup
- recipient lookup
- claim assistance
- envelope inspection

## 5. Design Principles

### 5.1 API first

If an operation exists in the API, the CLI should call the API or the SDK that wraps it.

### 5.2 Explicit mutation

Commands that change money movement or persistent state must be unambiguous.

### 5.3 Machine-readable by default when requested

Every useful command should support `--json`.

### 5.4 Stable output contracts

Human output can evolve carefully. JSON output must be treated as a compatibility surface.

### 5.5 Safe by default

Destructive or high-risk commands must require explicit confirmation.

## 6. Delivery Shape

Recommended package:

- `packages/cli`

Recommended binary name:

- `mcosm`

Recommended root scripts:

- `npm run cli -- <args>`

## 7. Package Structure

Recommended layout:

- `packages/cli/package.json`
- `packages/cli/src/main.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/config.ts`
- `packages/cli/src/context.ts`
- `packages/cli/src/output.ts`
- `packages/cli/src/errors.ts`
- `packages/cli/src/confirm.ts`
- `packages/cli/src/json.ts`
- `packages/cli/src/commands/health.ts`
- `packages/cli/src/commands/db.ts`
- `packages/cli/src/commands/recipient.ts`
- `packages/cli/src/commands/envelope.ts`
- `packages/cli/src/commands/intent.ts`
- `packages/cli/src/commands/payment.ts`
- `packages/cli/src/commands/notification.ts`
- `packages/cli/src/commands/settlement.ts`
- `packages/cli/src/commands/ledger.ts`
- `packages/cli/src/commands/agent.ts`

## 8. Runtime Modes

The CLI should support two modes.

### 8.1 Remote mode

Calls a running API over HTTP.

Use for:

- production
- staging
- shared dev
- integration testing

Requires:

- `MCOSM_BASE_URL`
- `MCOSM_API_KEY` if auth is enforced

### 8.2 Local maintenance mode

Directly uses runtime config for maintenance and setup actions.

Use only for:

- runtime health check
- schema apply
- local bootstrap
- emergency diagnostics

Do not let local maintenance mode expand into a general alternative backend.

## 9. Configuration Model

Configuration should be resolved from:

1. explicit command flags
2. named profile
3. environment variables
4. config file

### 9.1 Environment variables

Suggested CLI env vars:

- `MCOSM_BASE_URL`
- `MCOSM_API_KEY`
- `MCOSM_PROFILE`
- `DATABASE_URL`
- `PRIVY_APP_ID`
- `PRIVY_APP_SECRET`
- `ARC_SETTLEMENT_PRIVATE_KEY`
- `ARC_TESTNET_RPC_URL`
- `PORT`

### 9.2 Profile file

Recommended path:

- `~/.config/mcosm/config.json`

Recommended shape:

```json
{
  "defaultProfile": "local",
  "profiles": {
    "local": {
      "baseUrl": "http://127.0.0.1:3000"
    },
    "staging": {
      "baseUrl": "https://staging.api.mcosm.dev"
    },
    "prod": {
      "baseUrl": "https://api.mcosm.dev"
    }
  }
}
```

### 9.3 Config fields

Supported config fields should include:

- `baseUrl`
- `apiKey`
- `databaseUrl`
- `envFile`
- `outputFormat`
- `timeoutMs`

## 10. Global Flags

Every command should support:

- `--json`
- `--profile <name>`
- `--base-url <url>`
- `--api-key <key>`
- `--env-file <path>`
- `--timeout <ms>`
- `--verbose`

Mutation-capable commands should support:

- `--idempotency-key <key>`
- `--yes`
- `--dry-run` where meaningful

## 11. Command Tree

The command tree should be:

```text
mcosm
  health
    check
    api
  db
    apply-schema
    status
    reset
    seed
  recipient
    resolve
    get
    list
    claim
  envelope
    create
    get
    list
    evaluate
    update
  intent
    create
    get
    list
  payment
    create
    get
    list
    execute
    execute-async
    claim
  notification
    list
    retry
  settlement
    get
    replay
    inspect
  ledger
    account
    entries
    reconcile
  agent
    list
    status
```

## 12. Command Specifications

## 12.1 Health Commands

### `mcosm health check`

Purpose:

- validate local runtime dependencies
- print Postgres, Arc RPC, and Privy status

Examples:

```bash
mcosm health check
mcosm health check --json
```

Expected JSON output:

```json
{
  "status": "ok",
  "checks": [
    {
      "name": "postgres",
      "status": "ok"
    },
    {
      "name": "arc_rpc",
      "status": "ok",
      "detail": "0x4cef52"
    },
    {
      "name": "privy",
      "status": "ok",
      "detail": "configured"
    }
  ]
}
```

### `mcosm health api`

Purpose:

- query remote `/health`, `/healthz`, and `/readyz`

Examples:

```bash
mcosm health api
mcosm health api --base-url http://127.0.0.1:3000
```

## 12.2 DB Commands

### `mcosm db apply-schema`

Purpose:

- apply the current schema to `DATABASE_URL`

Examples:

```bash
mcosm db apply-schema
```

### `mcosm db status`

Purpose:

- report migration state
- report schema version when migration table exists

### `mcosm db reset`

Purpose:

- destructive local database reset

Rules:

- require `--yes`
- refuse remote or obviously non-local database URLs unless `--force`

### `mcosm db seed`

Purpose:

- seed dev records

Inputs:

- `--preset local`
- `--file seed.json`

## 12.3 Recipient Commands

### `mcosm recipient resolve`

Inputs:

- `--email <email>`
- `--agent-id <id>`
- `--wallet <address>`

Examples:

```bash
mcosm recipient resolve --email alice@gmail.com
mcosm recipient resolve --wallet 0xabc...
```

Validation:

- exactly one selector must be provided

### `mcosm recipient get`

Inputs:

- `--id <recipient-id>`

### `mcosm recipient list`

Filters:

- `--claim-status`
- `--owner-type`

### `mcosm recipient claim`

Inputs:

- `--recipient-id`
- `--email`
- `--privy-user-id`
- `--wallet-address` optional

Purpose:

- complete recipient claim
- optionally trigger wallet provisioning through backend

Examples:

```bash
mcosm recipient claim \
  --recipient-id pending:alice@gmail.com \
  --email alice@gmail.com \
  --privy-user-id did:privy:usr_123
```

## 12.4 Envelope Commands

### `mcosm envelope create`

Inputs:

- `--file <path>`

### `mcosm envelope get`

### `mcosm envelope list`

### `mcosm envelope evaluate`

Inputs:

- `--id <envelope-id>`
- `--file <intent-json>`

Purpose:

- dry-run envelope rules

### `mcosm envelope update`

Inputs:

- `--id <envelope-id>`
- `--file <patch-json>`

## 12.5 Intent Commands

### `mcosm intent create`

Inputs:

- `--file <path>`

### `mcosm intent get`

### `mcosm intent list`

## 12.6 Payment Commands

### `mcosm payment create`

Inputs:

- `--file <path>`

### `mcosm payment get`

### `mcosm payment list`

Filters:

- `--status`
- `--recipient-id`
- `--intent-id`

### `mcosm payment execute`

Inputs:

- `--id <payment-id>`

### `mcosm payment execute-async`

Inputs:

- `--id <payment-id>`

### `mcosm payment claim`

Inputs:

- `--id <payment-id>`
- `--wallet-address <address>`

## 12.7 Notification Commands

### `mcosm notification list`

Filters:

- `--channel`
- `--type`
- `--recipient`

### `mcosm notification retry`

Inputs:

- `--id <notification-id>`

## 12.8 Settlement Commands

### `mcosm settlement get`

### `mcosm settlement inspect`

### `mcosm settlement replay`

Inputs:

- `--payment-id <payment-id>`

## 12.9 Ledger Commands

These should be added only when the ledger exists.

Commands:

- `mcosm ledger account --id`
- `mcosm ledger entries --account-id`
- `mcosm ledger reconcile --reference-type --reference-id`

## 13. Input Model

The CLI should accept input through:

- flags for simple commands
- `--file` for structured JSON payloads
- `stdin` support for automation later

Rules:

- complex payloads should prefer file input
- file input should support JSON only initially
- files should be validated before remote submission

Example:

```bash
mcosm payment create --file ./examples/payment.json
```

## 14. Output Model

The CLI must support two modes.

### 14.1 Human mode

Requirements:

- concise
- readable
- stable enough for operators
- show IDs and statuses prominently

### 14.2 JSON mode

Requirements:

- valid JSON only
- no extra text
- stable top-level shape

### 14.3 Output shapes

For single resource:

```json
{
  "ok": true,
  "data": {}
}
```

For lists:

```json
{
  "ok": true,
  "data": []
}
```

For errors:

```json
{
  "ok": false,
  "error": {
    "code": "recipient_not_found",
    "message": "Recipient was not found"
  }
}
```

## 15. Exit Codes

Recommended exit codes:

- `0` success
- `1` generic failure
- `2` validation error
- `3` config or auth error
- `4` remote transport error
- `5` dependency health failure

## 16. Error Handling

Errors should be normalized into:

- CLI validation errors
- config errors
- remote API errors
- dependency health errors

Every mutation error should display:

- command name
- affected resource id if available
- backend error code if available
- next suggested action when obvious

## 17. Safety Rules

High-risk commands must require explicit confirmation:

- `db reset`
- `payment execute`
- `payment execute-async`
- `payment claim`
- `settlement replay`

Guardrails:

- `--yes` for dangerous actions
- `--dry-run` where meaningful
- refuse remote destructive DB commands by default

## 18. SDK Dependency

The CLI should depend on:

- `@mcosm/sdk`

The CLI should not:

- construct raw fetch calls for business operations when SDK support exists

Exceptions:

- bootstrapping SDK development itself
- direct maintenance commands like schema apply and raw health check

## 19. Implementation Plan

Build in this order:

1. CLI bootstrap and config
2. output and error normalization
3. `health`
4. `db`
5. `recipient`
6. `envelope`
7. `intent`
8. `payment`
9. `notification`
10. `settlement`
11. `ledger`

Each phase should include:

- parser tests
- command behavior tests
- JSON output tests

## 20. Testing Plan

### Unit tests

- flag parsing
- config precedence
- output rendering
- error normalization

### Integration tests

- local health checks
- remote API smoke tests
- payment create and execute test flow

### Golden tests

- JSON output shape tests
- stable operator-facing text output for key commands

## 21. Example Session

```bash
mcosm health check
mcosm recipient resolve --email alice@gmail.com
mcosm envelope create --file ./examples/envelope.json
mcosm intent create --file ./examples/intent.json
mcosm payment create --file ./examples/payment.json
mcosm payment execute-async --id pay_123
mcosm notification list --recipient alice@gmail.com
```

## 22. Exit Criteria

The CLI is ready when:

- a developer can bootstrap and verify local runtime entirely through CLI commands
- a support operator can inspect and assist recipient claim flows
- a payment can be created and executed through the CLI without custom scripts
- JSON output is stable enough for CI and automation
