import type { SupportStatus } from '@prisma/client';

export interface SupportReportView {
  id: string;
  subject: string | null;
  category: string | null;
  description: string;
  status: SupportStatus;
  adminResponse: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportInput {
  subject?: string;
  category?: string;
  description: string;
}
