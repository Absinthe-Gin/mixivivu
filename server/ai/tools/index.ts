/** Default tool set. To add a module: write its tools and register them here. */
import { catalogTools } from './catalogTools.ts';
import { knowledgeTools } from './knowledgeTools.ts';
import { ToolRegistry } from './registry.ts';
import { travelTools } from './travelTools.ts';

export function createDefaultRegistry(): ToolRegistry {
  return new ToolRegistry().register(...catalogTools, ...travelTools, ...knowledgeTools);
}
