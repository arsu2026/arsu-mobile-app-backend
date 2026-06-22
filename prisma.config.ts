import { defineConfig, env } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_DIRECT_URL') || env('DATABASE_URL'),
  },
});
