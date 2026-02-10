import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import prismaPlugin from './plugins/prisma.js'
import jwtPlugin from './plugins/jwt.js'
import multipartPlugin from './plugins/multipart.js'
import authRoutes from './routes/auth.js'
import pacientesRoutes from './routes/pacientes.js'
import atendimentosRoutes from './routes/atendimentos.js'
import { AppError, HttpStatus } from './errors.js'
import { Prisma } from '../generated/prisma/client.js'

const PRISMA_STATUS_MAP: Record<string, HttpStatus> = {
  P2002: HttpStatus.CONFLICT,
  P2025: HttpStatus.NOT_FOUND,
}

const isProduction = process.env.NODE_ENV === 'production'

const PRODUCTION_ORIGINS = [
  'https://ia.secretariapicones.com',
]

function getAllowedOrigins(): string[] {
  if (isProduction) return PRODUCTION_ORIGINS
  
  const port = process.env.FRONTEND_PORT || '5173'
  return [`http://localhost:${port}`]
}

export async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, {
    origin: getAllowedOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

  await app.register(prismaPlugin)
  await app.register(jwtPlugin)
  await app.register(multipartPlugin)

  await app.register(authRoutes)
  await app.register(pacientesRoutes)
  await app.register(atendimentosRoutes)

  app.setNotFoundHandler((_request, reply) => {
    reply.status(HttpStatus.NOT_FOUND).send({ error: 'Rota não encontrada' })
  })

  app.setErrorHandler<Error>((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.message,
        ...(error.details !== undefined && { details: error.details }),
      })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const status = PRISMA_STATUS_MAP[error.code] ?? HttpStatus.INTERNAL_SERVER_ERROR
      return reply.status(status).send({ error: error.message })
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: 'Erro de validação nos dados enviados' })
    }

    const statusCode = 'statusCode' in error ? (error as { statusCode: number }).statusCode : undefined
    if (statusCode && statusCode < HttpStatus.INTERNAL_SERVER_ERROR) {
      return reply.status(statusCode).send({ error: error.message })
    }

    request.log.error(error, 'Erro interno não tratado')
    return reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ error: 'Erro interno do servidor' })
  })

  return app
}
