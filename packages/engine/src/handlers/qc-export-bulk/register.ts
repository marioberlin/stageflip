// packages/engine/src/handlers/qc-export-bulk/register.ts

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import {
  QC_EXPORT_BULK_BUNDLE_NAME,
  QC_EXPORT_BULK_HANDLERS,
  QC_EXPORT_BULK_TOOL_DEFINITIONS,
} from './handlers.js';

export { QC_EXPORT_BULK_BUNDLE_NAME, QC_EXPORT_BULK_HANDLERS, QC_EXPORT_BULK_TOOL_DEFINITIONS };

export function registerQcExportBulkBundle<TContext extends MutationContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(QC_EXPORT_BULK_BUNDLE_NAME, QC_EXPORT_BULK_TOOL_DEFINITIONS);
  for (const handler of QC_EXPORT_BULK_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
