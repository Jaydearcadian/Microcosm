export const postgresSchemaPath = new URL("../postgres/schema.sql", import.meta.url);
export {
  createNodePostgresClient,
  createPostgresAppRepository,
  createPostgresIdentityRepository,
  type AppState,
  type AppStateRepository,
  type PostgresAppRepository,
  type SqlClient
} from "./postgres.ts";
