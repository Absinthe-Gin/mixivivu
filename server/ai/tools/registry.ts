/**
 * Central tool registry. Modules register their tools at start-up; the
 * orchestrator only asks the registry which tools a user may use.
 */
import type { LLMToolSpec } from '../providers/types.ts';
import type { Services } from '../services.ts';
import type { UserSettings } from '../settings/settingsService.ts';
import { type AnyTool, RISK_GROUP } from './types.ts';

const NAME = /^[a-z][a-z0-9_]{1,63}$/;

export interface ToolInfo {
  name: string;
  description: string;
  category: string;
  risk: AnyTool['risk'];
  group: 'A' | 'B' | 'C';
  confirmation: AnyTool['confirmation'];
  enabled: boolean;
  available: boolean;
}

export class ToolRegistry {
  private tools = new Map<string, AnyTool>();

  register(...defs: AnyTool[]): this {
    for (const def of defs) {
      if (!NAME.test(def.name)) throw new Error(`Invalid tool name "${def.name}"`);
      if (this.tools.has(def.name)) throw new Error(`Tool "${def.name}" is already registered`);
      if (def.parameters.type !== 'object') throw new Error(`Tool "${def.name}": parameters must be an object schema`);
      if (def.risk !== 'read' && !def.preview) throw new Error(`Tool "${def.name}": write tools need a preview for the confirmation card`);
      if (def.risk === 'read' && def.confirmation !== 'never') throw new Error(`Tool "${def.name}": read tools never need confirmation`);
      // Destructive tools always ask, whatever the definition says.
      this.tools.set(def.name, def.risk === 'destructive' ? { ...def, confirmation: 'always' } : def);
    }
    return this;
  }

  get(name: string): AnyTool | undefined {
    return this.tools.get(name);
  }

  all(): AnyTool[] {
    return [...this.tools.values()];
  }

  isEnabled(tool: AnyTool, settings: UserSettings, services: Services): boolean {
    if (tool.isAvailable && !tool.isAvailable(services)) return false;
    if (settings.disabledTools.includes(tool.name)) return false;
    if (tool.enabledByDefault === false && !settings.enabledTools.includes(tool.name)) return false;
    // Memory tools follow the long-term memory switch.
    if (tool.category === 'Bộ nhớ' && !settings.memoryEnabled) return false;
    return true;
  }

  /** Tool specs sent to the model for this user. */
  specsFor(settings: UserSettings, services: Services): LLMToolSpec[] {
    return this.all()
      .filter((t) => this.isEnabled(t, settings, services))
      .map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }));
  }

  describe(settings: UserSettings, services: Services): ToolInfo[] {
    return this.all().map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
      risk: t.risk,
      group: RISK_GROUP[t.risk],
      confirmation: t.confirmation,
      enabled: this.isEnabled(t, settings, services),
      available: !t.isAvailable || t.isAvailable(services),
    }));
  }
}
