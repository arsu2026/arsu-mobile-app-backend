import { validateDto } from '../../../../test/helpers/validate-dto';
import { CreateReportDto } from './create-report.dto';

describe('CreateReportDto', () => {
  it('accepts a description-only report', async () => {
    const errors = await validateDto(CreateReportDto, { description: 'The app crashed.' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing description', async () => {
    const errors = await validateDto(CreateReportDto, { subject: 'Bug' });
    expect(errors.map((e) => e.property)).toContain('description');
  });

  it('rejects a description over 1000 chars', async () => {
    const errors = await validateDto(CreateReportDto, { description: 'x'.repeat(1001) });
    expect(errors.map((e) => e.property)).toContain('description');
  });
});
