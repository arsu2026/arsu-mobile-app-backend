jest.mock('./support.repository');

import * as repo from './support.repository';
import { createReport, getInbox } from './support.service';

const mockCreate = repo.createReport as jest.Mock;
const mockList = repo.listByUser as jest.Mock;
const USER = '11111111-1111-4111-8111-111111111111';

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    subject: null,
    category: null,
    description: 'help',
    status: 'OPEN',
    adminResponse: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    ...over,
  };
}

describe('support.service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a report and maps it to a view', async () => {
    mockCreate.mockResolvedValue(row({ subject: 'Bug', description: 'It broke' }));
    const view = await createReport(USER, { subject: 'Bug', description: 'It broke' });
    expect(view).toMatchObject({ id: 'r1', subject: 'Bug', description: 'It broke', status: 'OPEN' });
    expect(mockCreate).toHaveBeenCalledWith(USER, { subject: 'Bug', description: 'It broke' });
  });

  it('returns a paginated inbox', async () => {
    mockList.mockResolvedValue({ rows: [row()], total: 1 });
    const result = await getInbox(USER, 1, 20);
    expect(mockList).toHaveBeenCalledWith(USER, 0, 20);
    expect(result.items[0].id).toBe('r1');
    expect(result.meta.total).toBe(1);
  });
});
