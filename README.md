# Doctors Aide - Backend

Backend for a medical records system built with Fastify, TypeScript, and Prisma. Handles doctor authentication, patient management, appointment processing, file ingestion, and n8n webhook integration for AI-powered medical record generation.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Fastify
- **ORM**: Prisma 7 (PostgreSQL)
- **Validation**: Zod
- **Auth**: JWT (`@fastify/jwt`)
- **File upload**: `@fastify/multipart`
- **Rate limiting**: `@fastify/rate-limit`
- **Testing**: Vitest

## Getting Started

### Prerequisites

- Node.js >= 20
- PostgreSQL

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable       | Description                      |
| -------------- | -------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string     |
| `JWT_SECRET`   | Secret key for JWT signing       |
| `N8N_URL`      | n8n webhook URL for AI processing|
| `N8N_SECRET`   | Bearer token for n8n auth        |
| `PORT`         | Server port (default: 3000)      |

### Database Setup

```bash
npm run db:migrate
npm run db:generate
```

### Running

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Testing

```bash
npm test
```

## API Endpoints

### Authentication

| Method | Endpoint         | Auth | Description                  |
| ------ | ---------------- | ---- | ---------------------------- |
| POST   | `/login-medico`  | No   | Login with CRM + UF, returns JWT |

### Patients

| Method | Endpoint              | Auth | Description                    |
| ------ | --------------------- | ---- | ------------------------------ |
| POST   | `/cadastrar-paciente` | Yes  | Register a new patient         |
| GET    | `/buscar-pacientes`   | Yes  | Search patients by name (`?query=`) |

### Appointments

| Method | Endpoint                      | Auth | Description                              |
| ------ | ----------------------------- | ---- | ---------------------------------------- |
| POST   | `/processar-atendimento`      | Yes  | Create appointment (multipart), calls n8n |
| GET    | `/atendimento/:id`            | Yes  | Get appointment status and prontuario     |
| GET    | `/medico/:id/atendimentos`    | Yes  | List doctor's appointments                |

## Project Structure

```
src/
  server.ts              # Entry point
  app.ts                 # Fastify app factory
  plugins/
    prisma.ts            # Prisma client plugin
    jwt.ts               # JWT auth + authenticate decorator
    multipart.ts         # File upload config
  routes/
    auth.ts              # Login endpoint
    pacientes.ts         # Patient CRUD
    atendimentos.ts      # Appointment processing
  services/
    n8n.service.ts       # n8n webhook integration
    storage.service.ts   # File storage
  schemas/
    medico.schema.ts     # Login validation
    paciente.schema.ts   # Patient validation
    atendimento.schema.ts # Appointment validation
tests/
  auth.service.test.ts
  paciente.service.test.ts
  atendimento.service.test.ts
```
