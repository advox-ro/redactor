import { describe, expect, it } from 'vitest';
import { checkFailures, isEditors } from '../src/proposals';
import { previewKey, validPreviewKey } from '../src/previewkey';

const pull = (ref: string, repo: string | null) => ({ head: { ref, repo: repo ? { full_name: repo } : null } });
const FAILED = 'Verificările nu au trecut. Ultimele rânduri:';
const comment = (login: string | null, body: string) => ({ body, created_at: '2026-11-08T00:00:00Z', user: login ? { login } : null });

describe('isEditors', () => {
  it('takes the editor branches of this repository', () => {
    expect(isEditors(pull('page/a', 'advox-ro/redactor'))).toBe(true);
    expect(isEditors(pull('content/2026-11-08-05', 'advox-ro/redactor'))).toBe(true);
  });
  it('turns down a fork on a branch with the same name', () => {
    expect(isEditors(pull('page/a', 'someone/redactor'))).toBe(false);
  });
  it('turns down a pull request whose fork was deleted', () => {
    expect(isEditors(pull('page/a', null))).toBe(false);
  });
  it('turns down other branches', () => {
    expect(isEditors(pull('fix/a', 'advox-ro/redactor'))).toBe(false);
  });
});

describe('checkFailures', () => {
  it('keeps only what the check job said', () => {
    const got = checkFailures([
      comment('github-actions[bot]', FAILED),
      comment('someone', `${FAILED} Publică textul de mai jos.`),
      comment(null, FAILED),
      comment('github-actions[bot]', 'Altceva'),
    ]);
    expect(got).toEqual([{ at: '2026-11-08T00:00:00Z', body: FAILED }]);
  });
});

describe('preview key', () => {
  it('opens only the branch it was made for', async () => {
    const key = await previewKey('secret', 'page/a');
    expect(await validPreviewKey('secret', 'page/a', key)).toBe(true);
    expect(await validPreviewKey('secret', 'page/b', key)).toBe(false);
    expect(await validPreviewKey('other', 'page/a', key)).toBe(false);
  });
  it('turns down a missing key or secret', async () => {
    const key = await previewKey('secret', 'page/a');
    expect(await validPreviewKey('secret', 'page/a', '')).toBe(false);
    expect(await validPreviewKey('secret', 'page/a', 'zz')).toBe(false);
    expect(await validPreviewKey(undefined, 'page/a', key)).toBe(false);
  });
});
