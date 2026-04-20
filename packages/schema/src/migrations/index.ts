// packages/schema/src/migrations/index.ts
// Public surface of the migrations framework.

export { findMigration, isCurrent, MIGRATIONS, migrate } from './registry.js';
export {
  MigrationError,
  type Migration,
  type MigrationRunResult,
} from './types.js';
