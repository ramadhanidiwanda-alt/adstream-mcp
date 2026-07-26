import fs from 'node:fs/promises';
import path from 'node:path';
import type { MetaPageWelcomeMessage } from '../types.js';

export const WELCOME_MESSAGE_TEMPLATE_STORE_ENV = 'ADSTREAM_WELCOME_MESSAGE_TEMPLATE_STORE';

export interface WelcomeMessageTemplate {
  name: string;
  pageWelcomeMessage: MetaPageWelcomeMessage;
  createdAt: string;
  updatedAt: string;
}

interface WelcomeMessageTemplateStore {
  templates: WelcomeMessageTemplate[];
}

export interface CreateWelcomeMessageTemplateOptions {
  name: string;
  pageWelcomeMessage: MetaPageWelcomeMessage;
}

export interface ListWelcomeMessageTemplatesOptions {
  name?: string;
}

function resolveStorePath(): string {
  return (
    process.env[WELCOME_MESSAGE_TEMPLATE_STORE_ENV]?.trim() ||
    path.join(process.cwd(), '.local', 'welcome-message-templates.json')
  );
}

function normalizeTemplateName(name: string): string {
  const normalized = name.trim();
  if (!normalized) throw new Error('name wajib diisi.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(normalized)) {
    throw new Error(
      'name hanya boleh memakai huruf, angka, titik, underscore, atau dash, maksimal 80 karakter.'
    );
  }
  return normalized;
}

function normalizePageWelcomeMessage(value: MetaPageWelcomeMessage): MetaPageWelcomeMessage {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) throw new Error('pageWelcomeMessage wajib diisi.');
    return normalized;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('pageWelcomeMessage harus berupa string atau object VISUAL_EDITOR.');
  }
  return value;
}

async function readStore(): Promise<WelcomeMessageTemplateStore> {
  const storePath = resolveStorePath();
  try {
    const raw = await fs.readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<WelcomeMessageTemplateStore>;
    if (!Array.isArray(parsed.templates)) return { templates: [] };
    return {
      templates: parsed.templates.filter(
        (template): template is WelcomeMessageTemplate =>
          typeof template?.name === 'string' &&
          (typeof template.pageWelcomeMessage === 'string' ||
            (typeof template.pageWelcomeMessage === 'object' &&
              template.pageWelcomeMessage !== null &&
              !Array.isArray(template.pageWelcomeMessage))) &&
          typeof template.createdAt === 'string' &&
          typeof template.updatedAt === 'string'
      ),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { templates: [] };
    throw error;
  }
}

async function writeStore(store: WelcomeMessageTemplateStore): Promise<void> {
  const storePath = resolveStorePath();
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(`${storePath}.tmp`, `${JSON.stringify(store, null, 2)}\n`);
  await fs.rename(`${storePath}.tmp`, storePath);
}

export async function createWelcomeMessageTemplate(
  options: CreateWelcomeMessageTemplateOptions
): Promise<WelcomeMessageTemplate> {
  const name = normalizeTemplateName(options.name);
  const pageWelcomeMessage = normalizePageWelcomeMessage(options.pageWelcomeMessage);
  const store = await readStore();
  const now = new Date().toISOString();
  const existing = store.templates.find((template) => template.name === name);
  const template: WelcomeMessageTemplate = {
    name,
    pageWelcomeMessage,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  store.templates = [...store.templates.filter((stored) => stored.name !== name), template].sort(
    (left, right) => left.name.localeCompare(right.name)
  );
  await writeStore(store);
  return template;
}

export async function listWelcomeMessageTemplates(
  options: ListWelcomeMessageTemplatesOptions = {}
): Promise<WelcomeMessageTemplate[]> {
  const name = options.name === undefined ? undefined : normalizeTemplateName(options.name);
  const store = await readStore();
  return store.templates.filter((template) => name === undefined || template.name === name);
}

export async function getWelcomeMessageTemplate(
  name: string
): Promise<WelcomeMessageTemplate | undefined> {
  return (await listWelcomeMessageTemplates({ name }))[0];
}
