export const postgresSchemaPath = new URL("../postgres/schema.sql", import.meta.url);
export {
  applyPostgresSchema,
  createNodePostgresClient,
  createPostgresAppRepository,
  createPostgresIdentityRepository,
  createPostgresSpaceService,
  type AppState,
  type AppStateRepository,
  type PostgresAppRepository,
  type PostgresSpaceService,
  type SqlClient
} from "./postgres.ts";
