import { fileURLToPath } from 'node:url';

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import {
  buildOpenApiDocument,
  CreateNoteRequestSchema,
  ListNotesQuerySchema,
  type OpenApiDocument,
} from '@dbp/iso-api-contract';
import { expect } from 'vitest';

// An absolute path, because loadFeature resolves relative paths from a stack frame that
// top-level await does not provide.
const feature = await loadFeature(
  fileURLToPath(new URL('../../features/notes-contract.feature', import.meta.url)),
);

describeFeature(feature, ({ Scenario }) => {
  Scenario('Default the page and page size of a list request', ({ Given, When, Then }) => {
    let query: Record<string, string>;
    let result: ReturnType<typeof ListNotesQuerySchema.safeParse>;

    Given('a list request with no query parameters', () => {
      query = {};
    });
    When('the request is validated against ListNotesQuerySchema', () => {
      result = ListNotesQuerySchema.safeParse(query);
    });
    Then('validation passes with page 1 and limit 20', () => {
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ page: 1, limit: 20 });
    });
  });

  Scenario('Reject a page size above the maximum', ({ Given, When, Then }) => {
    let query: Record<string, string>;
    let result: ReturnType<typeof ListNotesQuerySchema.safeParse>;

    // Query strings arrive as text. The schema coerces them before it checks the range.
    Given('a list request with limit "500"', () => {
      query = { limit: '500' };
    });
    When('the request is validated against ListNotesQuerySchema', () => {
      result = ListNotesQuerySchema.safeParse(query);
    });
    Then('validation fails on the "limit" field', () => {
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.path)).toEqual([['limit']]);
    });
  });

  Scenario('Reject a field the contract does not define', ({ Given, When, Then }) => {
    let body: Record<string, string>;
    let result: ReturnType<typeof CreateNoteRequestSchema.safeParse>;

    Given('a create request with a title and an extra field "color"', () => {
      body = { title: 'Groceries', color: 'blue' };
    });
    When('the request is validated against CreateNoteRequestSchema', () => {
      result = CreateNoteRequestSchema.safeParse(body);
    });
    Then('validation fails because "color" is not a known field', () => {
      expect(result.success).toBe(false);
      expect(result.error?.issues).toEqual([
        expect.objectContaining({ code: 'unrecognized_keys', keys: ['color'] }),
      ]);
    });
  });

  Scenario('Version every route', ({ Given, Then, And }) => {
    let document: OpenApiDocument;

    Given('the OpenAPI document for version "1.2.3"', () => {
      document = buildOpenApiDocument('1.2.3');
    });
    Then('every path starts with "/v1/"', () => {
      const paths = Object.keys(document.paths ?? {});
      expect(paths.length).toBeGreaterThan(0);
      expect(paths.filter((path) => !path.startsWith('/v1/'))).toEqual([]);
    });
    And('the document version is "1.2.3"', () => {
      expect(document.info.version).toBe('1.2.3');
    });
  });
});
