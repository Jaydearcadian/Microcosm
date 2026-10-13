import { readFileSync } from "node:fs";

import { postgresSchemaPath, createNodePostgresClient } from "../../../packages/db/src/index.ts";
import { getApiRuntimeConfig } from "./runtime.ts";

const main = async () => {
  const config = getApiRuntimeConfig();
  const client = await createNodePostgresClient({
    connectionString: config.databaseUrl
  });
  const schemaSql = readFileSync(postgresSchemaPath, "utf8");

  await client.query(schemaSql);

  console.log(
    JSON.stringify(
      {
        ok: true,
        applied: true,
        databaseUrl: config.databaseUrl
      },
      null,
      2
    )
  );
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "schema_apply_failed");
  process.exitCode = 1;
});
