import { z } from 'zod';

// Every schema is `.strict()`, so the API rejects unknown keys with a 400 instead of
// silently dropping them. That is why removing a request property breaks clients
// (docs/reference/schema-evolution.md).

/**
 * The machine-readable error shape every endpoint returns. Clients branch on `code`,
 * so codes are part of the contract and follow the same evolution rules as fields.
 * @public
 */
export const ErrorResponseSchema = z
  .object({
    /** The failure. Its shape is identical on every endpoint. */
    error: z
      .object({
        /** Stable machine-readable error code. Clients branch on it. */
        code: z.string().meta({ example: 'invalid_argument' }),
        /** What went wrong and how to fix it, for a human. */
        message: z.string().meta({ example: 'limit must be between 1 and 100, got 500' }),
        /** Structured data a client can act on, such as the invalid fields. */
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
  })
  .strict()
  .meta({ id: 'ErrorResponse' });

/**
 * The error body every endpoint returns, as validated by {@link ErrorResponseSchema}.
 *
 * @public
 */
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Offset pagination returned by every list endpoint. Lists paginate from their first
 * version, because adding pagination later changes the response shape.
 * @public
 */
export const PaginationSchema = z
  .object({
    /** The 1-based page this response holds. */
    page: z.int().min(1),
    /** The maximum number of items per page. */
    limit: z.int().min(1).max(100),
    /** Items across all pages. */
    total_items: z.int().min(0),
    /** Pages at the current `limit`. */
    total_pages: z.int().min(0),
  })
  .strict()
  .meta({ id: 'Pagination' });

/**
 * Pagination metadata of a list response, as validated by {@link PaginationSchema}.
 *
 * @public
 */
export type Pagination = z.infer<typeof PaginationSchema>;

/**
 * A note: the example resource this contract exposes.
 * @public
 */
export const NoteSchema = z
  .object({
    /** Server-assigned identifier. Never reused. */
    note_id: z.string().meta({ example: 'note_01J9Z3K8V6' }),
    /** Short title, 1 to 200 characters. */
    title: z.string().min(1).max(200),
    /** Note text, up to 10,000 characters. Empty when the note has none. */
    body: z.string().max(10_000),
    /** When the note was created, as an ISO 8601 timestamp. */
    created_at: z.iso.datetime(),
    /** When the note last changed, as an ISO 8601 timestamp. */
    updated_at: z.iso.datetime(),
  })
  .strict()
  .meta({ id: 'Note' });

/**
 * A note, as validated by {@link NoteSchema}.
 *
 * @public
 */
export type Note = z.infer<typeof NoteSchema>;

/**
 * Body of `POST /v1/notes`. A bare resource, not wrapped in an envelope.
 * @public
 */
export const CreateNoteRequestSchema = z
  .object({
    /** Short title, 1 to 200 characters. */
    title: z.string().min(1).max(200),
    /** Note text, up to 10,000 characters. Defaults to an empty string. */
    body: z.string().max(10_000).default(''),
  })
  .strict()
  .meta({ id: 'CreateNoteRequest' });

/**
 * What a client sends to create a note. `body` is optional and defaults to an empty string.
 *
 * @public
 */
export type CreateNoteRequest = z.input<typeof CreateNoteRequestSchema>;

/**
 * Body of `PATCH /v1/notes/{note_id}`. A merge update: absent fields keep their value.
 * @public
 */
export const UpdateNoteRequestSchema = z
  .object({
    /** New title. Leave it out to keep the current one. */
    title: z.string().min(1).max(200).optional(),
    /** New text. Leave it out to keep the current one. */
    body: z.string().max(10_000).optional(),
  })
  .strict()
  .meta({ id: 'UpdateNoteRequest' });

/**
 * What a client sends to update a note. Absent fields keep their value.
 *
 * @public
 */
export type UpdateNoteRequest = z.infer<typeof UpdateNoteRequestSchema>;

/**
 * Query parameters of `GET /v1/notes`.
 * @public
 */
export const ListNotesQuerySchema = z
  .object({
    /** The 1-based page to return. Defaults to 1. */
    page: z.coerce.number().int().min(1).default(1),
    /** Items per page, 1 to 100. Defaults to 20. */
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

/**
 * The query parameters a client sends to list notes. Both are optional.
 *
 * @public
 */
export type ListNotesQuery = z.input<typeof ListNotesQuerySchema>;

/**
 * Response of `GET /v1/notes/{note_id}`, `POST /v1/notes`, and `PATCH /v1/notes/{note_id}`.
 * @public
 */
export const NoteResponseSchema = z
  .object({
    /** The note. */
    data: NoteSchema,
  })
  .strict()
  .meta({ id: 'NoteResponse' });

/**
 * The response body that carries one note.
 *
 * @public
 */
export type NoteResponse = z.infer<typeof NoteResponseSchema>;

/**
 * Response of `GET /v1/notes`. The `data` array sits inside an envelope so the
 * response can grow new top-level fields without breaking clients.
 * @public
 */
export const ListNotesResponseSchema = z
  .object({
    /** The notes on this page. */
    data: z.array(NoteSchema),
    /** Where this page sits in the full list. */
    pagination: PaginationSchema,
  })
  .strict()
  .meta({ id: 'ListNotesResponse' });

/**
 * The response body that carries one page of notes.
 *
 * @public
 */
export type ListNotesResponse = z.infer<typeof ListNotesResponseSchema>;
