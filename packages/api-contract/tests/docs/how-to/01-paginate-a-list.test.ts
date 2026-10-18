/**
 * List endpoints return one page at a time. This guide parses the page parameters a
 * client sent and builds a list response with its pagination metadata.
 */
import {
  type ListNotesQuery,
  ListNotesQuerySchema,
  type ListNotesResponse,
  ListNotesResponseSchema,
  type Note,
  NoteSchema,
  type Pagination,
  PaginationSchema,
} from '@dbp/api-contract';
import { describe, expect, it } from 'vitest';

describe('Paginate a list', () => {
  /**
   * Query parameters arrive as strings. The schema converts them to numbers, applies the
   * defaults (`page` 1, `limit` 20), and rejects a `limit` above 100.
   */
  it('Parse the page parameters', () => {
    // #region query
    const raw: ListNotesQuery = { page: '2', limit: '50' };

    const { page, limit } = ListNotesQuerySchema.parse(raw);
    // #endregion query

    expect({ page, limit }).toEqual({ page: 2, limit: 50 });
    expect(ListNotesQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  /**
   * Compute the page from the total count, then validate the whole response. Validate each
   * stored note with `NoteSchema` too, so a malformed row fails here instead of in a client.
   */
  it('Build the list response', () => {
    // #region response
    const stored: unknown[] = [
      {
        note_id: 'note_1',
        title: 'Groceries',
        body: '',
        created_at: '2026-10-18T09:00:00Z',
        updated_at: '2026-10-18T09:00:00Z',
      },
    ];
    const totalItems = 41;
    const page = 3;
    const limit = 20;

    const notes: Note[] = stored.map((row) => NoteSchema.parse(row));
    const pagination: Pagination = PaginationSchema.parse({
      page,
      limit,
      total_items: totalItems,
      total_pages: Math.ceil(totalItems / limit),
    });
    const response: ListNotesResponse = ListNotesResponseSchema.parse({ data: notes, pagination });
    // #endregion response

    expect(response.pagination.total_pages).toBe(3);
    expect(response.data).toHaveLength(1);
  });
});
