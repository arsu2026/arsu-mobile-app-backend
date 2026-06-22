jest.mock('../../../prisma', () => ({
  prisma: { adminAuditLog: { create: jest.fn() } },
}));

import { prisma } from '../../../prisma';
import { writeAuditLog } from './admin-audit.repository';

const mockCreate = (prisma.adminAuditLog as { create: jest.Mock }).create;

describe('writeAuditLog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates an audit row with nullable fields defaulted to null', async () => {
    mockCreate.mockResolvedValue({ id: 'a1' });
    await writeAuditLog({ adminId: 'admin-1', action: 'admin.login', ipAddress: '127.0.0.1' });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        adminId: 'admin-1',
        action: 'admin.login',
        targetType: null,
        targetId: null,
        metadata: undefined,
        ipAddress: '127.0.0.1',
      },
    });
  });
});
