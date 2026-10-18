/**
 * `PATCH /v1/notes/{note_id}` is a merge update: fields the client leaves out keep their
 * stored value. This guide applies a validated update to a stored note.
 */
import { type Note, type UpdateNoteRequest, UpdateNoteRequestSchema } from '@dbp/api-contract';
import { describe, expect, it } from 'vitest';

describe('Update a note', () => {
  /**
   * Validate the patch, then take each field from the patch when it is present and from
   * the stored note otherwise. Set `updated_at` yourself, because the client never sends it.
   */
  it('Merge a patch into a stored note', () => {
    // #region merge
    const stored: Note = {
      note_id: 'note_1',
      title: 'Groceries',
      body: 'Milk',
      created_at: '2026-10-18T09:00:00Z',
      updated_at: '2026-10-18T09:00:00Z',
    };

    const patch: UpdateNoteRequest = UpdateNoteRequestSchema.parse({ body: 'Milk, eggs' });
    const updated: Note = {
      ...stored,
      title: patch.title ?? stored.title,
      body: patch.body ?? stored.body,
      updated_at: '2026-10-18T10:00:00Z',
    };
    // #endregion merge

    expect(updated).toMatchObject({ title: 'Groceries', body: 'Milk, eggs' });
  });
});
