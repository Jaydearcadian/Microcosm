# Microcosm Checkpoints And Backups

## 1. Purpose

This document defines how Microcosm progress should be checkpointed and backed up during development.

The goal is simple:

- every major implementation step should have a restorable snapshot
- backups should be secret-safe
- backups should be easy to export to Android storage
- status documentation should stay aligned with each checkpoint

## 2. Current Backup Mechanism

Current script:

- `scripts/create_checkpoint.py`

What it does:

- creates a timestamped checkpoint directory under `checkpoints/`
- copies the important repo files into that checkpoint
- writes a `manifest.json`
- writes a small checkpoint `README.md`
- creates a zip archive under `output/checkpoints/`
- can optionally export the zip to Android shared storage

## 3. What Gets Included

The checkpoint script includes:

- `README.md`
- `README.docx`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `apps/`
- `packages/`
- `scripts/`
- `docs/`
- `examples/`
- `skills-lock.json`

## 4. What Gets Excluded

The checkpoint script excludes:

- `.env`
- `node_modules/`
- `.git/`
- prior `output/`
- prior `checkpoints/`

This keeps the backup:

- smaller
- safer
- easier to move between devices

## 5. How To Create A Checkpoint

Basic checkpoint:

```bash
python3 scripts/create_checkpoint.py runtime-hardening
```

Checkpoint plus Android export:

```bash
python3 scripts/create_checkpoint.py runtime-hardening --android
```

This creates:

- a checkpoint directory in `checkpoints/`
- a zip archive in `output/checkpoints/`
- optionally a copied archive in `/storage/emulated/0/Download/microcosm-checkpoints/`

## 6. When To Create A Checkpoint

Create a checkpoint:

- before major refactors
- after major refactors
- after adding deployment assets
- after changing schema or repository logic
- before moving work to another machine
- before starting contracts
- before introducing worker infrastructure

## 7. Documentation Rule Going Forward

For each meaningful milestone:

1. update status docs
2. create a checkpoint
3. export the archive if needed

The docs that should be updated when the repo meaningfully changes are:

- `MICROCOSM_STATUS`
- `MICROCOSM_IMPLEMENTATION_MATRIX`
- `MICROCOSM_NEXT_STEPS`

## 8. Recommended Milestone Labels

Use labels that reflect the actual work completed:

- `runtime-ready`
- `postgres-repos`
- `worker-foundation`
- `arc-contracts-v1`
- `sdk-surface`
- `cli-v1`

Avoid vague labels like:

- `latest`
- `stuff`
- `changes`

## 9. Restore Guidance

To restore from a checkpoint archive:

1. extract the archive on a normal PC
2. recreate `.env` manually from real secrets
3. run `npm install`
4. run Postgres
5. run `npm run db:apply-schema`
6. run `npm run check:api-runtime`
7. run `npm run start:api`

## 10. Recommended Practice For This Project

Because this repo is currently being advanced partly from mobile environments, checkpoints should be treated as mandatory, not optional.

That is the practical way to avoid losing:

- exact repo state
- docs state
- deployment artifacts
- implementation history between major steps

## 11. Summary

Microcosm now has a built-in checkpoint path.

That means progress can be:

- documented
- zipped
- exported
- restored

without depending on git history or a fully provisioned PC environment.
