/**
 * Readers for the loosely-typed values the MCP SDK hands back to tests.
 *
 * Both helpers validate at runtime and throw on an unexpected shape, so a tool
 * that stops returning what the test is about fails loudly instead of yielding
 * `undefined` into an assertion that then trivially passes.
 */

/**
 * The text of the first content block of a `client.callTool` result.
 *
 * The SDK types the result as a union of the modern shape (an index signature
 * plus content blocks that may be text / image / audio / resource) and the
 * legacy compatibility shape (`toolResult`, no `content` at all), so
 * `result.content[0].text` is an error in a test even though every tool in this
 * server answers with a text block.
 */
export function toolResultText(result: Record<string, unknown>): string {
  const content = result.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error(
      `Expected the tool result to carry content blocks, got ${JSON.stringify(content)}`
    );
  }
  const first: unknown = content[0];
  if (typeof first !== 'object' || first === null || !('text' in first)) {
    throw new Error(`Expected the first content block to be text, got ${JSON.stringify(first)}`);
  }
  const { text } = first as { text: unknown };
  if (typeof text !== 'string') {
    throw new Error(
      `Expected the first content block's text to be a string, got ${JSON.stringify(text)}`
    );
  }
  return text;
}

/**
 * One property of a registered tool's `inputSchema`.
 *
 * `Tool['inputSchema'].properties` is optional and its values are typed `object`,
 * so drilling into a property's `description` is an error. Returning
 * `Record<string, unknown>` keeps the drill honest: a typo'd key still yields
 * `unknown`, not `any`.
 */
export function toolSchemaProperty(
  tool: { inputSchema: { properties?: Record<string, unknown> } } | undefined,
  property: string
): Record<string, unknown> {
  if (!tool) {
    throw new Error(`Expected a tool to look up "${property}" on, got undefined`);
  }
  const properties = tool.inputSchema.properties;
  if (!properties) {
    throw new Error(`Expected the tool's inputSchema to declare properties`);
  }
  const value = properties[property];
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Expected inputSchema property "${property}" to be a schema object`);
  }
  return value as Record<string, unknown>;
}
