import { defaultExclude, defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Sibling git worktrees live inside the repo (.worktrees/ and
    // .claude/worktrees/). vitest's defaultExclude only covers node_modules and
    // .git, so without this it globs their copies of the suite and runs several
    // other branches' tests as if they belonged to the checked-out branch.
    exclude: [...defaultExclude, '**/.worktrees/**', '**/.claude/worktrees/**'],
  },
  resolve: {
    alias: {
      'meta-ads-agent-skill': path.resolve(__dirname, 'src/index.ts'),
    },
  },
});
