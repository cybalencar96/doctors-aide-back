import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/server.ts',
        'src/plugins/prisma.ts',
        'src/services/ai/prompts/**',
        'src/services/ai/ai-client.ts',
        'src/services/ai/agents.ts',
        'src/services/file-processor.service.ts',
        'src/services/storage.service.ts',
      ],
    },
  },
})
