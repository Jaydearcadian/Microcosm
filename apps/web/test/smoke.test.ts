import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("apps/web contains required configuration and app route entries", () => {
  const rootDir = path.resolve(import.meta.dirname, "..");
  
  // Package.json exists and has correct workspace name
  const pkgPath = path.join(rootDir, "package.json");
  assert.ok(fs.existsSync(pkgPath), "package.json must exist");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  assert.equal(pkg.name, "@mcosm/web");

  // Core entry points exist
  assert.ok(fs.existsSync(path.join(rootDir, "app/layout.tsx")), "layout.tsx must exist");
  assert.ok(fs.existsSync(path.join(rootDir, "app/page.tsx")), "page.tsx must exist");
  assert.ok(fs.existsSync(path.join(rootDir, "app/globals.css")), "globals.css must exist");
  assert.ok(fs.existsSync(path.join(rootDir, "components/providers.tsx")), "providers.tsx must exist");
});
