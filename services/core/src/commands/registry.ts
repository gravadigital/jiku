import { Command } from './types';

interface Entry {
  command: Command<any, any>;
  /** Segmentos del patrón: `clients.{id}.edit` -> ['clients', '{id}', 'edit'] */
  segments: string[];
}

/**
 * Compara un patrón —ya partido en segmentos— contra el nombre de un método, y devuelve los
 * params capturados o `null` si no matchea.
 *
 * SE EXTRAJO DE `resolve()` EN S-017 porque la compuerta de autorización necesita el MISMO
 * matching sin resolver el comando: CA-6 la pone ANTES de `resolve()`. Duplicar diez líneas
 * habría dejado el mismo algoritmo sutil en dos archivos, y el comentario de la clase explica
 * por qué es sutil — una regex ingenua se rompe con un `.` dentro de un valor.
 *
 * Un objeto VACÍO es un match válido (un patrón sin params), así que el caller compara contra
 * `null` explícitamente y no con un `if` a secas sobre el valor.
 */
function matchSegments(segments: string[], parts: string[]): Record<string, string> | null {
  if (segments.length !== parts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.startsWith('{') && segment.endsWith('}')) {
      params[segment.slice(1, -1)] = parts[i];
    } else if (segment !== parts[i]) {
      return null;
    }
  }

  return params;
}

/**
 * ¿El nombre de un método matchea un patrón con `{param}`?
 *
 * SU OTRO CONSUMIDOR ES LA COMPUERTA DE AUTORIZACIÓN (`src/authorize-caller.ts`), que compara el
 * método recibido contra los patrones del mapa rol → método ANTES de resolver el comando. No la
 * reemplaces por una regex ni la muevas: el mapa y el registry TIENEN que matchear igual, o un
 * caller quedaría autorizado a un patrón que el registry resuelve distinto.
 */
export function matchesPattern(pattern: string, name: string): boolean {
  return matchSegments(pattern.split('.'), name.split('.')) !== null;
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
      const params = matchSegments(entry.segments, parts);
      if (params !== null) {
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
