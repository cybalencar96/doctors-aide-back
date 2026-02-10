import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import prismaPlugin from './plugins/prisma.js'
import jwtPlugin from './plugins/jwt.js'
import multipartPlugin from './plugins/multipart.js'
import authRoutes from './routes/auth.js'
import pacientesRoutes from './routes/pacientes.js'
import atendimentosRoutes from './routes/atendimentos.js'

export async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, {
    origin: ['https://doctor-s-aide.onrender.com', 'https://ia.secretariapicones.com.br'],
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

  return app
}
