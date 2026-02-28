/**
 * AI Model Registry
 *
 * Maps logical model roles to versioned model identifiers loaded from
 * Config_Service (environment variables with fallback defaults).
 */

import { getConfig } from '../config-service';

export type ModelRole = 'micro' | 'orchestrator' | 'analyzer' | 'processor' | 'specialist';

const roleToConfigKey: Record<ModelRole, keyof ReturnType<typeof getConfig>['ai']> = {
  micro: 'modelMicro',
  orchestrator: 'modelOrchestrator',
  analyzer: 'modelAnalyzer',
  processor: 'modelProcessor',
  specialist: 'modelSpecialist',
};

/**
 * Returns the model identifier for the given role.
 * Reads from Config_Service which resolves env vars with fallback defaults.
 */
export function getModelId(role: ModelRole): string {
  return getConfig().ai[roleToConfigKey[role]];
}
