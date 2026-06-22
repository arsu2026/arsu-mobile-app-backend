import { validateDto } from '../../../../test/helpers/validate-dto';
import { MemoriesQueryDto } from './memories-query.dto';

describe('MemoriesQueryDto', () => {
  it('accepts an absent date', async () => {
    const errors = await validateDto(MemoriesQueryDto, {});
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid MM-DD date', async () => {
    const errors = await validateDto(MemoriesQueryDto, { date: '06-17' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a malformed date', async () => {
    const errors = await validateDto(MemoriesQueryDto, { date: '2026-06-17' });
    expect(errors.map((e) => e.property)).toContain('date');
  });

  it('rejects an out-of-range month', async () => {
    const errors = await validateDto(MemoriesQueryDto, { date: '13-01' });
    expect(errors.map((e) => e.property)).toContain('date');
  });
});
