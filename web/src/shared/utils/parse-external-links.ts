import externalLogoGithub from '@root/assets/ExternalLogos/github.svg';
import externalLogoHedgedoc from '@root/assets/ExternalLogos/hedgedoc.svg';
import externalLogoMail from '@root/assets/ExternalLogos/mailu.png';
import externalLogoMattermost from '@root/assets/ExternalLogos/mattermost.svg';

export interface ExternalLinkConfig {
  readonly href: string;
  readonly icon: string;
  readonly label: string;
}

/**
 * Accesos directos a las herramientas del equipo, en el pie de la navegación.
 *
 * Se configuran con `EXTERNAL_LINKS`, un JSON con la forma
 * `[{"tool":"github","href":"https://...","label":"Código"}]`. Sin esa variable el
 * bloque no se muestra: son enlaces a la infraestructura de cada equipo, no del producto.
 *
 * `tool` elige el ícono entre los disponibles; si no coincide con ninguno, se usa el
 * genérico.
 */
const EXTERNAL_LINK_ICONS: Record<string, typeof externalLogoGithub> = {
  github: externalLogoGithub,
  gitlab: externalLogoGithub,
  hedgedoc: externalLogoHedgedoc,
  mattermost: externalLogoMattermost,
  mail: externalLogoMail,
};

export function parseExternalLinks(raw?: string): ExternalLinkConfig[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as { tool?: string; href: string; label: string }[];
    return parsed
      .filter((link) => link.href && link.label)
      .map((link) => ({
        href: link.href,
        label: link.label,
        icon: EXTERNAL_LINK_ICONS[link.tool ?? ''] ?? externalLogoGithub,
      }));
  } catch {
    // Una variable mal formada no debería tumbar la navegación entera.
    console.error('La configuración de enlaces externos no es un JSON válido; se ignora.');
    return [];
  }
}
