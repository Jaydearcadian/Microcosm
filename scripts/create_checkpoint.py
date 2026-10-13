#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from sys import argv
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
CHECKPOINTS_DIR = ROOT / "checkpoints"
OUTPUT_DIR = ROOT / "output" / "checkpoints"
ANDROID_DIR = Path("/storage/emulated/0/Download/microcosm-checkpoints")

INCLUDE_PATHS = [
    "README.md",
    "README.docx",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "Dockerfile",
    "docker-compose.yml",
    ".dockerignore",
    "apps",
    "packages",
    "scripts",
    "docs",
    "examples",
    "skills-lock.json",
]

EXCLUDE_DIR_NAMES = {
    "node_modules",
    ".git",
    "output",
    "checkpoints",
    "__pycache__",
}

EXCLUDE_FILE_NAMES = {
    ".env",
}


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-") or "checkpoint"


def walk_relative_files() -> list[Path]:
    files: list[Path] = []
    for entry in INCLUDE_PATHS:
        path = ROOT / entry
        if not path.exists():
            continue
        if path.is_file():
            if path.name not in EXCLUDE_FILE_NAMES:
                files.append(path.relative_to(ROOT))
            continue
        for child in path.rglob("*"):
            if child.is_dir():
                continue
            if any(part in EXCLUDE_DIR_NAMES for part in child.relative_to(ROOT).parts):
                continue
            if child.name in EXCLUDE_FILE_NAMES:
                continue
            files.append(child.relative_to(ROOT))
    return sorted(set(files))


def copy_files(files: list[Path], destination: Path) -> None:
    for relative in files:
        source = ROOT / relative
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def write_manifest(destination: Path, label: str, files: list[Path]) -> Path:
    manifest = {
        "label": label,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "root": str(ROOT),
        "file_count": len(files),
        "files": [str(path) for path in files],
        "excluded": {
            "directories": sorted(EXCLUDE_DIR_NAMES),
            "files": sorted(EXCLUDE_FILE_NAMES),
        },
    }
    manifest_path = destination / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest_path


def write_summary(destination: Path, label: str, files: list[Path], archive_path: Path) -> None:
    lines = [
        "# Microcosm Checkpoint",
        "",
        f"- Label: `{label}`",
        f"- Created at: `{datetime.now(timezone.utc).isoformat()}`",
        f"- File count: `{len(files)}`",
        f"- Archive: `{archive_path.name}`",
        "",
        "## Included Top-Level Paths",
        "",
        "- `README.md` and `README.docx`",
        "- `package.json`, `package-lock.json`, `tsconfig.json`",
        "- `Dockerfile`, `docker-compose.yml`, `.dockerignore`",
        "- `apps/`",
        "- `packages/`",
        "- `scripts/`",
        "- `docs/`",
        "- `examples/`",
        "- `skills-lock.json`",
        "",
        "## Excluded",
        "",
        "- `.env`",
        "- `node_modules/`",
        "- previous `output/` archives",
        "- previous `checkpoints/`",
        "- `.git/`",
        "",
        "## Current Recommended Restore Sequence",
        "",
        "1. Extract the archive on a normal PC.",
        "2. Recreate `.env` from your real secrets.",
        "3. Run `npm install`.",
        "4. Start Postgres.",
        "5. Run `npm run db:apply-schema`.",
        "6. Run `npm run check:api-runtime`.",
        "7. Run `npm run start:api`.",
        "",
    ]
    (destination / "README.md").write_text("\n".join(lines), encoding="utf-8")


def write_zip(source_dir: Path, archive_path: Path) -> None:
    archive_path.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(archive_path, "w", ZIP_DEFLATED) as zf:
        for file_path in sorted(source_dir.rglob("*")):
            if file_path.is_dir():
                continue
            zf.write(file_path, file_path.relative_to(source_dir))


def main() -> int:
    label = slugify(argv[1]) if len(argv) > 1 else "manual"
    export_android = "--android" in argv[2:] or "--android" in argv[1:]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    checkpoint_name = f"{timestamp}-{label}"
    checkpoint_dir = CHECKPOINTS_DIR / checkpoint_name
    archive_path = OUTPUT_DIR / f"{checkpoint_name}.zip"

    files = walk_relative_files()
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    copy_files(files, checkpoint_dir)
    write_manifest(checkpoint_dir, label, files)
    write_summary(checkpoint_dir, label, files, archive_path)
    write_zip(checkpoint_dir, archive_path)

    result = {
      "checkpoint_dir": str(checkpoint_dir),
      "archive": str(archive_path),
      "file_count": len(files),
    }

    if export_android:
        ANDROID_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(archive_path, ANDROID_DIR / archive_path.name)
        result["android_copy"] = str(ANDROID_DIR / archive_path.name)

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

