import { describe, expect, it } from 'vitest';
import { normalizeAccountId } from '../src/utils/normalizeAccountId.js';

describe('normalizeAccountId', () => {
  it('strips act_ prefix when present', () => {
    expect(normalizeAccountId('act_1417353822551653')).toBe('1417353822551653');
  });

  it('returns numeric ID unchanged when no prefix', () => {
    expect(normalizeAccountId('1417353822551653')).toBe('1417353822551653');
  });

  it('handles short numeric IDs', () => {
    expect(normalizeAccountId('12345')).toBe('12345');
  });

  it('handles act_ with short numeric part', () => {
    expect(normalizeAccountId('act_12345')).toBe('12345');
  });

  it('does not strip act_ that appears in the middle', () => {
    expect(normalizeAccountId('xact_12345')).toBe('xact_12345');
  });

  it('handles empty string after act_ prefix', () => {
    expect(normalizeAccountId('act_')).toBe('');
  });

  it('handles single act_ without digits', () => {
    expect(normalizeAccountId('act_abc')).toBe('abc');
  });
});
