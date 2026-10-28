import 'mocha';
import 'should';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * Política del bus para el módulo de documentación (S-075). Fija como IGUALDAD EXACTA lo que cada
 * plantilla del auth-callout concede: un permiso de más es una ampliación de seguridad (ADR-007).
 * Todo se lee con `js-yaml`: los encabezados de las plantillas mencionan los patrones prohibidos
 * para explicarlos, así que un `grep` de texto crudo daría falsos positivos.
 */

const AUTH_CALLOUT_DIR = path.join(__dirname, '../../../deploy/nats/auth-callout');
const TEMPLATES_DIR = path.join(AUTH_CALLOUT_DIR, 'templates');

interface Template {
  pub?: { allow?: string[] };
  sub?: { allow?: string[] };
  response?: { max?: number; ttl?: string };
}
interface Rule {
  match?: string;
  template?: string;
}

function load(name: string): Template {
  return yaml.load(fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf8')) as Template;
}

function loadRules(): Rule[] {
  const doc = yaml.load(fs.readFileSync(path.join(AUTH_CALLOUT_DIR, 'rules.yaml'), 'utf8')) as {
    rules: Rule[];
  };
  return doc.rules;
}

function allTemplateNames(): string[] {
  return fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.yaml'));
}

function uniq(list: string[]): string[] {
  return [...new Set(list)];
}

/** Igualdad por conjunto (orden libre) y sin duplicados en el `allow` real. */
function sameSet(actual: string[] | undefined, expected: string[], why: string): void {
  const a = actual ?? [];
  const msg = (extra: string) => `${why} — ${extra}`;
  (a.length === new Set(a).size).should.equal(true, msg('hay líneas duplicadas en allow'));
  const aSorted = [...new Set(a)].sort();
  const eSorted = [...new Set(expected)].sort();
  const missing = eSorted.filter((x) => !aSorted.includes(x));
  const extra = aSorted.filter((x) => !eSorted.includes(x));
  missing.should.deepEqual([], msg(`faltan: ${JSON.stringify(missing)}`));
  extra.should.deepEqual([], msg(`sobran: ${JSON.stringify(extra)}`));
}

// ---------------------------------------------------------------------------------------------
// Listas esperadas: se declaran UNA vez y se componen.
// ---------------------------------------------------------------------------------------------

/** Lectura y watch del registro de módulos. Idéntico en connector, docs y las dos de persona. */
const KV_READ_WATCH = [
  '$JS.API.INFO',
  '$JS.API.STREAM.INFO.KV_JIKU_MODULES',
  '$JS.API.DIRECT.GET.KV_JIKU_MODULES.>',
  // SIN sufijo: nats.js recrea así el consumidor ordenado al resetearse (jsclient.js:590).
  '$JS.API.CONSUMER.CREATE.KV_JIKU_MODULES',
  '$JS.API.CONSUMER.CREATE.KV_JIKU_MODULES.>',
  '$JS.FC.KV_JIKU_MODULES.>',
];

/**
 * Espacio KV del SDK en JIKU_KV: cada identidad, SOLO sus claves (`{{instance}}.{{user_id}}.<clave>`).
 * Son las tres líneas de RequiredKVPermissions de jiku-go / requiredKVPermissions de jiku-ts.
 */
const JIKU_KV_SPACE = [
  '$JS.API.STREAM.INFO.KV_JIKU_KV',
  '$KV.JIKU_KV.{{instance}}.{{user_id}}.>',
  '$JS.API.DIRECT.GET.KV_JIKU_KV.$KV.JIKU_KV.{{instance}}.{{user_id}}.>',
];

const JIKU_EVENTS_CONSUMER = [
  '$JS.API.INFO',
  '$JS.API.STREAM.INFO.JIKU_EVENTS',
  '$JS.API.CONSUMER.CREATE.JIKU_EVENTS.>',
  '$JS.API.CONSUMER.DURABLE.CREATE.JIKU_EVENTS.>',
  '$JS.API.CONSUMER.INFO.JIKU_EVENTS.>',
  '$JS.API.CONSUMER.MSG.NEXT.JIKU_EVENTS.>',
];

const JIKU_DOCS_EVENTS_CONSUMER = [
  '$JS.API.STREAM.INFO.JIKU_DOCS_EVENTS',
  '$JS.API.CONSUMER.CREATE.JIKU_DOCS_EVENTS.>',
  '$JS.API.CONSUMER.DURABLE.CREATE.JIKU_DOCS_EVENTS.>',
  '$JS.API.CONSUMER.INFO.JIKU_DOCS_EVENTS.>',
  '$JS.API.CONSUMER.MSG.NEXT.JIKU_DOCS_EVENTS.>',
];

const EXPECTED_CONNECTOR = {
  pub: uniq([
    '{{instance}}.{{user_id}}.jiku-commands.v1.>',
    '{{instance}}.{{user_id}}.jiku-queries.v1.>',
    '{{instance}}.{{user_id}}.jiku-docs-commands.v1.>',
    '{{instance}}.{{user_id}}.jiku-docs-queries.v1.>',
    '$SRV.PING.>',
    ...JIKU_EVENTS_CONSUMER,
    ...JIKU_DOCS_EVENTS_CONSUMER,
    ...KV_READ_WATCH,
    ...JIKU_KV_SPACE,
  ]),
  sub: ['{{instance}}.events.v1.>', '_INBOX.{{user_id_hash}}.>'],
};

const EXPECTED_DOCS = {
  pub: uniq([
    ...EXPECTED_CONNECTOR.pub,
    '{{instance}}.docs-events.v1.>',
    '{{instance}}.*.docs-notify.v1.>',
    '$JS.API.STREAM.*.JIKU_DOCS_EVENTS',
    '$KV.JIKU_MODULES.docs',
  ]),
  sub: [
    '{{instance}}.events.v1.>',
    '_INBOX.{{user_id_hash}}.>',
    '{{instance}}.*.jiku-docs-commands.v1.>',
    '{{instance}}.*.jiku-docs-queries.v1.>',
    '$SRV.>',
  ],
};

const EXPECTED_PERSON_INTERNAL = {
  pub: uniq([
    '{{instance}}.{{user_id}}.jiku-queries.v1.>',
    '{{instance}}.{{user_id}}.jiku-commands.v1.>',
    '{{instance}}.{{user_id}}.jiku-docs-queries.v1.>',
    '{{instance}}.{{user_id}}.jiku-docs-commands.v1.>',
    ...KV_READ_WATCH,
  ]),
  sub: ['_INBOX.{{user_id_hash}}.>', '{{instance}}.{{user_id}}.docs-notify.v1.>'],
};

const EXPECTED_PERSON_INTERNAL_NAME = 'person-internal.yaml';

const EXPECTED_PERSON_EXTERNAL = {
  pub: uniq([
    '{{instance}}.{{user_id}}.jiku-queries.v1.>',
    '{{instance}}.{{user_id}}.jiku-docs-queries.v1.>',
    ...KV_READ_WATCH,
  ]),
  sub: ['_INBOX.{{user_id_hash}}.>'],
};

const EXPECTED_CORE = {
  pub: ['{{instance}}.{{user_id}}.>', '{{instance}}.events.v1.>'],
  sub: [
    '{{instance}}.*.jiku-commands.v1.>',
    '{{instance}}.*.jiku-queries.v1.>',
    '{{instance}}.events.auth',
    '$SRV.>',
    '_INBOX.{{user_id_hash}}.>',
  ],
  response: { max: 1, ttl: '45s' },
};

const PERSON_TEMPLATES = [EXPECTED_PERSON_INTERNAL_NAME, 'person-external.yaml'];

describe('bus/bus-policy-structure — política del bus para docs (S-075)', () => {
  it('TS-1 · R-1 / CA-9 · la regla docs va antes que internal-app', () => {
    const matches = loadRules().map((r) => r.match);
    matches.should.deepEqual(['docs', 'internal-app', 'core', 'admin', 'user', 'external-user']);
    (matches.indexOf('docs') < matches.indexOf('internal-app')).should.equal(
      true,
      'R-1: con docs debajo de internal-app el machine user cae en connector.yaml y reinicia en loop al suscribirse a jiku-docs-*',
    );
  });

  it('TS-2 · CA-9 · docs apunta a docs.yaml y toda plantilla referenciada existe', () => {
    const rules = loadRules();
    for (const rule of rules) {
      fs.existsSync(path.join(AUTH_CALLOUT_DIR, rule.template as string)).should.equal(
        true,
        `la plantilla ${rule.template} de la regla ${rule.match} no existe`,
      );
    }
    rules.find((r) => r.match === 'docs')!.template!.should.equal('templates/docs.yaml');
  });

  it('TS-3 · CA-S1 · sin catch-all', () => {
    for (const rule of loadRules()) {
      (typeof rule.match === 'string').should.equal(true, 'toda regla necesita match (ADR-008)');
      ['*', '>', ''].includes(rule.match as string).should.equal(
        false,
        'ADR-008: un rol que no esté en rules.yaml NO conecta; un catch-all lo rompe',
      );
    }
  });

  it('TS-4 · CA-9 · docs.yaml igualdad exacta', () => {
    const t = load('docs.yaml');
    sameSet(t.pub?.allow, EXPECTED_DOCS.pub, 'docs.yaml pub.allow');
    sameSet(t.sub?.allow, EXPECTED_DOCS.sub, 'docs.yaml sub.allow');
    t.response!.should.deepEqual({ max: 1, ttl: '45s' });
  });

  it('TS-5 · CA-9 · invariante docs ⊇ connector', () => {
    const connector = load('connector.yaml');
    const docs = load('docs.yaml');
    const missingPub = (connector.pub!.allow as string[]).filter((l) => !docs.pub!.allow!.includes(l));
    const missingSub = (connector.sub!.allow as string[]).filter((l) => !docs.sub!.allow!.includes(l));
    missingPub.should.deepEqual(
      [],
      'H-P2: el indexer de jiku-docs consume su propio stream con los permisos de connector; docs.yaml debe incluirlos todos',
    );
    missingSub.should.deepEqual([], 'H-P2: docs.yaml debe incluir todo el sub de connector.yaml');
  });

  it('TS-6 · CA-10 · docs escribe solo su clave del registro', () => {
    for (const name of allTemplateNames()) {
      const t = load(name);
      const lines = [...(t.pub?.allow ?? []), ...(t.sub?.allow ?? [])];
      const own = lines.filter((l) => l === '$KV.JIKU_MODULES.docs');
      own.length.should.equal(
        name === 'docs.yaml' ? 1 : 0,
        `CA-10: $KV.JIKU_MODULES.docs solo en docs.yaml (${name})`,
      );
      const wide = lines.filter(
        (l) => l === '$KV.JIKU_MODULES.>' || l === '$KV.>' || l === '$KV.JIKU_MODULES.*',
      );
      wide.should.deepEqual([], `CA-10: ${name} no puede escribir otras claves del registro`);
    }
  });

  it('TS-7 · CA-11 / CA-S1 · connector.yaml igualdad exacta', () => {
    const t = load('connector.yaml');
    sameSet(t.pub?.allow, EXPECTED_CONNECTOR.pub, 'connector.yaml pub.allow');
    sameSet(t.sub?.allow, EXPECTED_CONNECTOR.sub, 'connector.yaml sub.allow');
    t.response!.max!.should.equal(0);
  });

  it('TS-8 · CA-11 · el conector no atiende docs ni publica eventos de docs', () => {
    const t = load('connector.yaml');
    (t.sub!.allow as string[])
      .filter((l) => l.includes('jiku-docs-') || l.includes('$SRV.'))
      .should.deepEqual([], 'CA-11: el conector no se suscribe a subjects de servicio de docs');
    (t.pub!.allow as string[])
      .filter((l) => l.includes('docs-events') || l.includes('docs-notify'))
      .should.deepEqual([], 'CA-11: el conector no publica eventos ni notificaciones de docs');
  });

  it('TS-9 · CA-12 / CA-S1 · person-internal.yaml igualdad exacta', () => {
    const t = load(EXPECTED_PERSON_INTERNAL_NAME);
    sameSet(t.pub?.allow, EXPECTED_PERSON_INTERNAL.pub, 'person-internal pub.allow');
    sameSet(t.sub?.allow, EXPECTED_PERSON_INTERNAL.sub, 'person-internal sub.allow');
    (t.response === undefined).should.equal(true, 'una persona no atiende requests');
  });

  it('TS-10 · CA-13 / CA-S1 · person-external.yaml igualdad exacta', () => {
    const t = load('person-external.yaml');
    sameSet(t.pub?.allow, EXPECTED_PERSON_EXTERNAL.pub, 'person-external pub.allow');
    sameSet(t.sub?.allow, EXPECTED_PERSON_EXTERNAL.sub, 'person-external sub.allow');
    [...(t.pub!.allow as string[]), ...(t.sub!.allow as string[])]
      .filter(
        (l) => l.includes('jiku-commands') || l.includes('jiku-docs-commands') || l.includes('docs-notify'),
      )
      .should.deepEqual([], 'CA-13: external-user no recibe comandos ni notificaciones');
  });

  it('TS-11 · CA-S1 · core.yaml no cambia', () => {
    const t = load('core.yaml');
    sameSet(t.pub?.allow, EXPECTED_CORE.pub, 'core.yaml pub.allow');
    sameSet(t.sub?.allow, EXPECTED_CORE.sub, 'core.yaml sub.allow');
    t.response!.should.deepEqual(EXPECTED_CORE.response);
  });

  it('TS-12 · R-4 · JetStream de personas acotado al registro', () => {
    for (const name of PERSON_TEMPLATES) {
      const t = load(name);
      const lines = [...(t.pub?.allow ?? []), ...(t.sub?.allow ?? [])];
      lines
        .filter((l) => l.startsWith('$JS.API.STREAM.') && !l.startsWith('$JS.API.STREAM.INFO.'))
        .should.deepEqual([], `R-4: ${name} no puede mutar streams, solo INFO`);
      lines.filter((l) => l.startsWith('$KV.')).should.deepEqual([], `R-4: ${name} no escribe el KV`);
      lines
        .filter((l) => l.includes('JIKU_DOCS_EVENTS') || l.includes('JIKU_EVENTS'))
        .should.deepEqual([], `R-4: ${name} no toca los streams de eventos`);
      lines
        .filter((l) => l.startsWith('$JS.API.CONSUMER.') && !l.includes('KV_JIKU_MODULES'))
        .should.deepEqual([], `R-4: los consumidores de ${name} son solo del registro`);
    }
  });

  it('TS-13 · CA-S1 · nadie tiene $JS.API.> ni comodín de servicio', () => {
    for (const name of allTemplateNames()) {
      const t = load(name);
      const lines = [...(t.pub?.allow ?? []), ...(t.sub?.allow ?? [])];
      lines.includes('$JS.API.>').should.equal(false, `${name}: $JS.API.> es administración completa de JetStream`);
      lines.includes('{{instance}}.events.>').should.equal(
        false,
        `${name}: sin versión se comería {{instance}}.events.auth (ADR-014)`,
      );
      if (name !== 'core.yaml') {
        lines.includes('{{instance}}.{{user_id}}.>').should.equal(
          false,
          `${name}: solo core.yaml puede tener el comodín de servicio (ADR-008)`,
        );
      }
    }
  });

  it('TS-14 · H-P1 · KV_READ_WATCH idéntico en las cuatro plantillas e incluye la forma pelada', () => {
    for (const name of ['connector.yaml', 'docs.yaml', EXPECTED_PERSON_INTERNAL_NAME, 'person-external.yaml']) {
      const pub = load(name).pub!.allow as string[];
      KV_READ_WATCH.filter((l) => !pub.includes(l)).should.deepEqual(
        [],
        `${name} debe llevar las seis líneas de KV_READ_WATCH`,
      );
      pub.includes('$JS.API.CONSUMER.CREATE.KV_JIKU_MODULES').should.equal(
        true,
        'H-P1: el reset del consumidor ordenado de nats.js (jsclient.js:590) crea sin sufijo; sin esta línea el watch muere en silencio',
      );
    }
  });
  it('TS-15 · espacio KV (JIKU_KV) acotado a la propia identidad', () => {
    // Cada una de estas abre las claves de TODAS las identidades: escribir (`$KV.JIKU_KV.>`) o
    // leer con la clave en el body (DIRECT.GET pelado, STREAM.MSG.GET), que ningún subject acota.
    const wide = [
      '$KV.JIKU_KV.>',
      '$KV.JIKU_KV.*',
      '$KV.JIKU_KV.{{instance}}.>',
      '$KV.JIKU_KV.{{instance}}.*.>',
      '$JS.API.DIRECT.GET.KV_JIKU_KV',
      '$JS.API.DIRECT.GET.KV_JIKU_KV.>',
      '$JS.API.STREAM.MSG.GET.KV_JIKU_KV',
      '$JS.API.CONSUMER.CREATE.KV_JIKU_KV.>',
    ];
    for (const name of allTemplateNames()) {
      const t = load(name);
      const lines = [...(t.pub?.allow ?? []), ...(t.sub?.allow ?? [])];
      lines.filter((l) => wide.includes(l)).should.deepEqual([], `${name} alcanza claves de otras identidades`);
      lines
        .filter((l) => l.includes('JIKU_KV') && !JIKU_KV_SPACE.includes(l))
        .should.deepEqual([], `${name}: JIKU_KV solo con las tres líneas acotadas a {{user_id}}`);
    }
    for (const name of PERSON_TEMPLATES) {
      const pub = load(name).pub!.allow as string[];
      pub
        .filter((l) => l.includes('JIKU_KV'))
        .should.deepEqual([], `${name}: las personas no tienen espacio KV`);
    }
  });
});
