import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { ENV_REGISTRY, EnvRegistryEntry } from './env-registry';

export interface EnvRuntimeEntry extends EnvRegistryEntry {
  /** Whether this variable was set via environment (not using the registered default). */
  setByEnv: boolean;
  /** Current resolved value. Always a string (or null if unset and no default). Secrets are returned as null with `hasValue` true when set. */
  value: string | null;
  /** For secrets: whether a value is present (set by env or default). Value itself is masked. */
  hasValue: boolean;
}

@Injectable()
export class ConfigService {
  constructor(private readonly nestConfigService: NestConfigService) {}

  getEnvRuntime(): EnvRuntimeEntry[] {
    return ENV_REGISTRY.map((entry) => {
      const raw = this.nestConfigService.get<string>(entry.key);
      const setByEnv = raw !== undefined && raw !== null && raw !== '';
      const effective = setByEnv ? raw : (entry.defaultValue ?? null);
      const hasValue = effective !== null && effective !== undefined;

      return {
        ...entry,
        setByEnv,
        hasValue,
        value: entry.secret ? null : (effective ?? null),
      };
    });
  }
}
