import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

const plugin = readJson('.claude-plugin/plugin.json');
const marketplace = readJson('.claude-plugin/marketplace.json');

describe('plugin manifest', () => {
  // The plugin exists so the skills/ directory travels with the MCP server; a skills
  // path that no longer resolves silently ships the server without its instructions.
  it('lists skill directories that exist and hold at least one SKILL.md', () => {
    const skillPaths = plugin.skills as string[];

    expect(skillPaths.length).toBeGreaterThan(0);
    for (const skillPath of skillPaths) {
      const absolute = path.join(repoRoot, skillPath);
      expect(fs.existsSync(absolute), `${skillPath} does not exist`).toBe(true);

      const found = fs
        .readdirSync(absolute, { recursive: true, encoding: 'utf8' })
        .some((entry) => entry.endsWith('SKILL.md'));
      expect(found, `${skillPath} contains no SKILL.md`).toBe(true);
    }
  });

  it('points the MCP command at the built server entry', () => {
    const servers = plugin.mcpServers as Record<string, { args: string[] }>;
    const entry = servers['adstream-mcp'].args[0].replace('${CLAUDE_PLUGIN_ROOT}/', '');

    expect(entry).toBe((readJson('package.json').bin as Record<string, string>)['adstream-mcp']);
  });

  it('keeps the marketplace entry aligned with the plugin it publishes', () => {
    const entries = marketplace.plugins as { name: string; version: string; source: string }[];
    const entry = entries.find((candidate) => candidate.name === plugin.name);

    expect(entry).toBeDefined();
    expect(entry?.version).toBe(plugin.version);
    expect(entry?.version).toBe(readJson('package.json').version);
  });
});
