import fp from 'fastify-plugin'
import multipart from '@fastify/multipart'
import type { FastifyInstance } from 'fastify'

export default fp(async (fastify: FastifyInstance) => {
  fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50 MB
      files: 10,
    },
  })
})
