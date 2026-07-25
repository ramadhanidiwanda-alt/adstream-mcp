/**
 * Test helpers for reading JSON responses.
 *
 * Node's `Response.json()` resolves to `unknown`, so every `body.field` in a test
 * is a type error even though the assertion below it is perfectly sound. Casting
 * at each call site would bury the tests in noise, so the cast lives here once.
 *
 * `Record<string, unknown>` rather than `any` on purpose: indexing still yields
 * `unknown`, which `expect()` accepts, while a typo'd nested drill
 * (`body.a.b`) stays an error instead of silently passing type checking.
 */
export async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

/** Read a JSON response and pull one field out as a string. */
export async function readJsonString(response: Response, field: string): Promise<string> {
  const body = await readJson(response);
  const value = body[field];
  if (typeof value !== 'string') {
    throw new Error(`Expected "${field}" to be a string, got ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Drill into a nested plain object, validating each hop.
 *
 * Payload builders and API readers return `Record<string, unknown>`, so a test
 * that wants `result.a.b.c` hits "of type 'unknown'" at the second hop. Casting
 * per drill would hide a genuinely missing level; this throws instead, naming
 * the hop that was not an object.
 */
export function readNested(value: unknown, ...path: string[]): Record<string, unknown> {
  let current: unknown = value;
  const walked: string[] = [];
  for (const key of path) {
    if (typeof current !== 'object' || current === null) {
      throw new Error(
        `Expected an object at ${walked.join('.') || '<root>'}, got ${JSON.stringify(current)}`
      );
    }
    current = (current as Record<string, unknown>)[key];
    walked.push(key);
  }
  if (typeof current !== 'object' || current === null) {
    throw new Error(`Expected an object at ${walked.join('.')}, got ${JSON.stringify(current)}`);
  }
  return current as Record<string, unknown>;
}

/** Like {@link readNested}, but the value at the end of the path must be an array. */
export function readNestedArray(value: unknown, ...path: string[]): unknown[] {
  const parent = path.length > 1 ? readNested(value, ...path.slice(0, -1)) : value;
  const key = path[path.length - 1];
  const found =
    key === undefined ? parent : (parent as Record<string, unknown> | null | undefined)?.[key];
  if (!Array.isArray(found)) {
    throw new Error(`Expected an array at ${path.join('.')}, got ${JSON.stringify(found)}`);
  }
  return found;
}
