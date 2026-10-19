/**
 * Every endpoint reports failures in the same shape, so clients handle errors once. This
 * guide turns a failed validation into that shape.
 */
import {
  type ErrorResponse,
  ErrorResponseSchema,
  UpdateNoteRequestSchema,
} from '@dbp/iso-api-contract';
import { describe, expect, it } from 'vitest';

describe('Return an error', () => {
  /**
   * Put a stable machine-readable `code` and a message that tells the client what to fix.
   * Put the details a client can act on in `details`.
   */
  it('Turn a validation failure into an error response', () => {
    // #region error
    const result = UpdateNoteRequestSchema.safeParse({ title: '' });

    let body: ErrorResponse | undefined;
    if (!result.success) {
      body = ErrorResponseSchema.parse({
        error: {
          code: 'invalid_argument',
          message: 'title must not be empty',
          details: { fields: result.error.issues.map((issue) => issue.path.join('.')) },
        },
      });
    }
    // #endregion error

    expect(body?.error.code).toBe('invalid_argument');
    expect(body?.error.details).toEqual({ fields: ['title'] });
  });
});
