import { Document, isMap, isScalar, isSeq, parseDocument } from 'yaml';
import { FRONTMATTER } from './frontmatter';
import type { DocsVisibility } from '../types/docs.types';

export interface DocProperties {
  title: string;
  visibility: DocsVisibility;
  topics: string[];
  clients: number[];
  projects: number[];
  requirements: number[];
  tasks: number[];
}

export type EditableProperties = Pick<
  DocProperties,
  'title' | 'visibility' | 'topics' | 'clients' | 'projects'
>;

export type ReadableContent = {
  readable: true;
  /** Bloque completo con delimitadores; `null` si no hay frontmatter. */
  raw: string | null;
  /** El YAML interior. */
  frontmatter: string | null;
  body: string;
  values: Partial<DocProperties>;
};

export type ParsedContent = ReadableContent | { readable: false };

const OPTS = { flowCollectionPadding: false, lineWidth: 0 } as const;
const VISIBILITIES: readonly string[] = ['internal', 'public', 'restricted'];
const UNREADABLE: ParsedContent = { readable: false };
const OPENS = /^---[ \t]*\r?\n/;

const isIntList = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((x) => Number.isInteger(x));
const isStringList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Igual que jiku-docs: minúsculas, sin acentos, kebab-case. */
export function normalizeTopic(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readValues(js: unknown): Partial<DocProperties> | null {
  if (js === null || js === undefined) return {};
  if (typeof js !== 'object' || Array.isArray(js)) return null;
  const obj = js as Record<string, unknown>;
  const values: Partial<DocProperties> = {};

  if (obj.title !== undefined) {
    if (typeof obj.title !== 'string') return null;
    values.title = obj.title;
  }
  if (obj.visibility !== undefined) {
    if (typeof obj.visibility !== 'string' || !VISIBILITIES.includes(obj.visibility)) return null;
    values.visibility = obj.visibility as DocsVisibility;
  }
  if (obj.topics !== undefined) {
    if (!isStringList(obj.topics)) return null;
    values.topics = obj.topics;
  }
  if (obj.jiku !== undefined) {
    const jiku = obj.jiku;
    if (typeof jiku !== 'object' || jiku === null || Array.isArray(jiku)) return null;
    const j = jiku as Record<string, unknown>;
    for (const key of ['clients', 'projects', 'requirements', 'tasks'] as const) {
      if (j[key] === undefined) continue;
      if (!isIntList(j[key])) return null;
      values[key] = j[key] as number[];
    }
  }
  return values;
}

export function parseContent(content: string): ParsedContent {
  const match = content.match(FRONTMATTER);
  if (!match) {
    if (OPENS.test(content)) return UNREADABLE;
    return { readable: true, raw: null, frontmatter: null, body: content, values: {} };
  }
  const raw = match[0];
  const body = content.slice(raw.length);
  const lines = raw.split(/\r?\n/);
  // Primera línea `---`; la de cierre es la última no vacía.
  const closeIndex = lines.length - 1 - [...lines].reverse().findIndex((l) => l !== '');
  const frontmatter = lines.slice(1, closeIndex).join('\n');

  const doc = parseDocument(frontmatter);
  if (doc.errors.length > 0) return UNREADABLE;
  if (doc.contents !== null && !isMap(doc.contents)) return UNREADABLE;
  const values = readValues(doc.toJS());
  if (values === null) return UNREADABLE;
  return { readable: true, raw, frontmatter, body, values };
}

const sameList = <T>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

export function composeContent(
  parsed: ReadableContent,
  initial: EditableProperties,
  next: EditableProperties,
  body: string
): string {
  const titleChanged = initial.title !== next.title;
  const visibilityChanged = initial.visibility !== next.visibility;
  const topicsChanged = !sameList(initial.topics, next.topics);
  const clientsChanged = !sameList(initial.clients, next.clients);
  const projectsChanged = !sameList(initial.projects, next.projects);

  if (!(titleChanged || visibilityChanged || topicsChanged || clientsChanged || projectsChanged)) {
    return (parsed.raw ?? '') + body;
  }

  const doc = parseDocument(parsed.frontmatter ?? '');
  const setScalar = (key: string, value: string) => {
    const node = doc.getIn([key], true);
    if (isScalar(node)) node.value = value;
    else doc.setIn([key], value);
  };
  const setList = (path: string[], value: unknown[]) => {
    const node = doc.getIn(path, true);
    if (isSeq(node)) node.items = value.map((x) => doc.createNode(x));
    else doc.setIn(path, doc.createNode(value, { flow: true }));
  };

  if (titleChanged) setScalar('title', next.title);
  if (visibilityChanged) setScalar('visibility', next.visibility);
  if (topicsChanged) setList(['topics'], next.topics);
  if (clientsChanged) setList(['jiku', 'clients'], next.clients);
  if (projectsChanged) setList(['jiku', 'projects'], next.projects);

  return `---\n${doc.toString(OPTS)}---\n${body}`;
}

export function buildNewDocumentContent(props: DocProperties): string {
  const obj: Record<string, unknown> = { title: props.title, visibility: props.visibility };
  if (props.topics.length > 0) obj.topics = props.topics;
  const jiku: Record<string, number[]> = {};
  for (const key of ['clients', 'projects', 'requirements', 'tasks'] as const) {
    if (props[key].length > 0) jiku[key] = props[key];
  }
  if (Object.keys(jiku).length > 0) obj.jiku = jiku;

  const doc = new Document(obj);
  const flow = (path: string[]) => {
    const node = doc.getIn(path, true);
    if (isSeq(node)) node.flow = true;
  };
  flow(['topics']);
  for (const key of Object.keys(jiku)) flow(['jiku', key]);

  return `---\n${doc.toString(OPTS)}---\n\n# ${props.title}\n`;
}
