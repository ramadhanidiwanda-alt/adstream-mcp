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
