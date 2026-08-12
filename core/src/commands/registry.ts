import { Command } from './types';

interface Entry {
  command: Command<any, any>;
  /** Segmentos del patrón: `clients.{id}.edit` -> ['clients', '{id}', 'edit'] */
  segments: string[];
}

/**
 * Registro de comandos: resuelve el nombre de un comando al handler que lo atiende,
 * extrayendo de paso los parámetros del patrón.
 *
 * El matching es por segmentos y no por expresión regular a propósito: los ids del
 * protocolo pueden ser números (`clients.7.edit`) o strings de Zitadel
 * (`requirements.3.subscriptors.<zitadel-user-id>.delete`), y un `.` dentro de un
 * valor rompería una regex ingenua. Comparar segmento a segmento no tiene ese problema.
 */
export class CommandRegistry {
  private entries: Entry[] = [];

  register(command: Command<any, any>): this {
    this.entries.push({ command, segments: command.pattern.split('.') });
    return this;
  }

  registerAll(commands: Command<any, any>[]): this {
    commands.forEach((c) => this.register(c));
    return this;
  }

  /** Devuelve el comando que atiende `name`, con sus parámetros. */
  resolve(name: string): { command: Command<any, any>; params: Record<string, string> } | null {
    const parts = name.split('.');

    for (const entry of this.entries) {
      if (entry.segments.length !== parts.length) {
        continue;
      }

      const params: Record<string, string> = {};
      let matches = true;

      for (let i = 0; i < entry.segments.length; i++) {
        const segment = entry.segments[i];
        if (segment.startsWith('{') && segment.endsWith('}')) {
          params[segment.slice(1, -1)] = parts[i];
        } else if (segment !== parts[i]) {
          matches = false;
          break;
        }
      }

      if (matches) {
        return { command: entry.command, params };
      }
    }

    return null;
  }

  /** Patrones registrados. Para logging y tests. */
  patterns(): string[] {
    return this.entries.map((e) => e.command.pattern);
  }
}
