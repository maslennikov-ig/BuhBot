/**
 * Template Services Index
 *
 * Exports all template-related services.
 *
 * @module services/templates
 */

export {
  substituteVariables,
  extractVariables,
  validateVariables,
  SUPPORTED_VARIABLES,
  type VariableContext,
  type SupportedVariable,
} from './variable.service.js';
