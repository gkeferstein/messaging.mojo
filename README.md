# MOJO Messaging

Zentrales Messaging-System für das MOJO-Ökosystem. Ermöglicht Echtzeit-Kommunikation zwischen allen MOJO-Nutzern mit granularen Berechtigungsregeln.

## Features

- ✅ **Echtzeit-Messaging** via WebSocket (Socket.io)
- ✅ **REST API** für CRUD-Operationen
- ✅ **Multi-Tenant Support** - Kommunikation innerhalb von Organisationen
- ✅ **Permission System** - Regeln wer mit wem kommunizieren darf
- ✅ **Kontaktanfragen** - Für cross-tenant Kommunikation
- ✅ **Online-Status & Presence** - Wer ist gerade online?
- ✅ **Typing-Indicators** - "User tippt..."
- ✅ **Read Receipts** - Lesebestätigungen
- ✅ **Rate-Limiting** - Spam-Schutz
- ✅ **Clerk Integration** - Authentifizierung via Clerk JWT

## URLs

| Environment | URL |
|-------------|-----|
| Production | `https://messaging.mojo-institut.de` |
| Development | `http://localhost:3020` |

## Quick Start

### 1. Repository klonen

```bash
cd /root/projects/messaging.mojo
```

### 2. Environment konfigurieren

```bash
cp apps/api/.env.example apps/api/.env
# Secrets anpassen (Clerk, DB, etc.)
nano apps/api/.env
```

### 3. Docker starten

```bash
# Production
docker compose up -d

# Development (mit Hot-Reload)
docker compose up -d
```

### 4. Datenbank initialisieren

```bash
# In den API-Container
docker compose exec api sh

# Migrationen
npx prisma migrate deploy

# Seed-Daten
npx prisma db seed
```

### 5. Testen

```bash
# Health Check
curl http://localhost:3020/api/v1/health

# Detailed Health
curl http://localhost:3020/api/v1/health/detailed
```

## Architektur

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           messaging.mojo                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Fastify Server                               │   │
│  │                                                                      │   │
│  │   REST API                          Socket.io                       │   │
│  │   /api/v1/conversations             ws://...                        │   │
│  │   /api/v1/messages                  • message:send                  │   │
│  │   /api/v1/contacts                  • typing:start/stop             │   │
│  │                                     • presence:online/offline       │   │
│  └─────────────────────┬───────────────────────────┬───────────────────┘   │
│                        │                           │                        │
│  ┌─────────────────────┴───────────────────────────┴───────────────────┐   │
│  │                         Services                                     │   │
│  │   • MessagingService - Konversationen & Nachrichten                 │   │
│  │   • PermissionService - Berechtigungsprüfung                        │   │
│  └─────────────────────┬───────────────────────────┬───────────────────┘   │
│                        │                           │                        │
│  ┌─────────────────────┴─────────┐   ┌─────────────┴───────────────────┐   │
│  │      PostgreSQL               │   │          Redis                   │   │
│  │   • Conversations             │   │   • PubSub (Socket.io)          │   │
│  │   • Messages                  │   │   • Online-Status               │   │
│  │   • Participants              │   │   • Typing-Indicators           │   │
│  │   • ContactRequests           │   │   • Session Cache               │   │
│  │   • MessagingRules            │   │                                 │   │
│  └───────────────────────────────┘   └─────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## API Dokumentation

### REST API

Siehe [docs/api-reference.md](docs/api-reference.md) für vollständige Dokumentation.

#### Authentifizierung

Alle Endpoints (außer Health) erfordern einen Clerk JWT im `Authorization` Header:

```
Authorization: Bearer <clerk-jwt>
```

#### Basis-Endpoints

| Endpoint | Method | Beschreibung |
|----------|--------|--------------|
| `/api/v1/health` | GET | Health Check |
| `/api/v1/conversations` | GET | Alle Konversationen |
| `/api/v1/conversations` | POST | Neue Konversation |
| `/api/v1/conversations/:id/messages` | GET | Nachrichten laden |
| `/api/v1/conversations/:id/messages` | POST | Nachricht senden |
| `/api/v1/messages/unread` | GET | Ungelesene Nachrichten |
| `/api/v1/contacts/requests` | GET/POST | Kontaktanfragen |
| `/api/v1/contacts/can-message/:userId` | GET | Berechtigung prüfen |

### WebSocket API

Siehe [docs/websocket-events.md](docs/websocket-events.md) für vollständige Dokumentation.

#### Verbindung

```javascript
import { io } from 'socket.io-client';

const socket = io('wss://messaging.mojo-institut.de', {
  auth: {
    token: clerkJWT,
    tenantId: 'optional-org-id'
  }
});
```

#### Events

| Event | Richtung | Beschreibung |
|-------|----------|--------------|
| `message:send` | Client → Server | Nachricht senden |
| `message:new` | Server → Client | Neue Nachricht |
| `message:sent` | Server → Client | Sende-Bestätigung |
| `typing:start` | Client → Server | Typing starten |
| `typing:stop` | Client → Server | Typing stoppen |
| `typing:update` | Server → Client | Typing-Status |
| `messages:read` | Bidirektional | Als gelesen markieren |
| `presence:online` | Server → Client | User online |
| `presence:offline` | Server → Client | User offline |

## Permission System

Das Messaging-System verwendet ein regelbasiertes Permission-System:

### Standard-Regeln

1. **Team-intern** - Mitglieder derselben Organisation können frei kommunizieren
2. **Cross-Org Manager** - Owner/Admins können andere Owner/Admins kontaktieren (Kontaktanfrage nötig)
3. **Support-Kanal** - Alle können den MOJO Support kontaktieren
4. **Plattform-Ankündigungen** - Platform-Admins können Broadcasts senden

### Regeln konfigurieren

```sql
-- Beispiel: Neue Regel hinzufügen
INSERT INTO "MessagingRule" (id, name, "sourceScope", "sourceRoles", "targetScope", "targetRoles", "requireApproval", priority)
VALUES ('custom-rule', 'Meine Regel', 'platform', '["admin"]', 'platform', '["member"]', true, 60);
```

## Widget-Integration

Dieses System ist als **eigenständiger Service** konzipiert. Apps integrieren es über API, **nicht** über shared packages.

### Warum kein Shared Package?

- ✅ **Fehlertoleranz** - Ein Bug hier crasht nicht alle Apps
- ✅ **Unabhängiges Deployment** - Apps können unabhängig deployen
- ✅ **API-Versionierung** - Breaking Changes kontrollierbar
- ✅ **Lose Kopplung** - Apps bleiben eigenständig

### Integration Guide

Siehe [docs/widget-standards.md](docs/widget-standards.md) für:

- Widget-Implementierungsrichtlinien
- TypeScript Types zum Copy-Paste
- UI/UX Standards

## Development

### Lokale Entwicklung

```bash
cd apps/api

# Dependencies installieren
npm install

# Prisma Client generieren
npx prisma generate

# Dev-Server starten
npm run dev
```

### Prisma Studio

```bash
cd apps/api
npx prisma studio
```

### Tests

```bash
npm test
```

## Deployment

### Docker

```bash
# Build & Start
docker compose up -d --build

# Logs
docker compose logs -f api

# Migrationen
docker compose exec api npx prisma migrate deploy
```

### Traefik

Das Projekt ist für Traefik konfiguriert:

- Domain: `messaging.mojo-institut.de`
- SSL: Let's Encrypt (automatisch)
- WebSocket: Unterstützt

## Projektstruktur

```
messaging.mojo/
├── apps/
│   └── api/
│       ├── src/
│       │   ├── index.ts              # Server Entry
│       │   ├── config/
│       │   │   └── env.ts            # Environment
│       │   ├── lib/
│       │   │   ├── prisma.ts         # Database
│       │   │   └── redis.ts          # Cache & PubSub
│       │   ├── middleware/
│       │   │   └── auth.ts           # Clerk JWT Auth
│       │   ├── routes/
│       │   │   ├── health.ts
│       │   │   ├── conversations.ts
│       │   │   ├── messages.ts
│       │   │   └── contacts.ts
│       │   ├── services/
│       │   │   ├── messaging.ts
│       │   │   └── permissions.ts
│       │   └── websocket/
│       │       └── server.ts         # Socket.io
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── seed.ts
│       ├── Dockerfile
│       └── package.json
├── docs/
│   ├── PORT.md
│   ├── api-reference.md
│   ├── websocket-events.md
│   ├── widget-standards.md
│   └── types.ts
├── docker-compose.yml
└── README.md
```

## Troubleshooting

### WebSocket verbindet nicht

1. Prüfe CORS-Origins in `.env`
2. Prüfe Clerk JWT Gültigkeit
3. Prüfe Redis-Verbindung

### Nachrichten kommen nicht an

1. Prüfe ob User Participant ist
2. Prüfe Permission-Rules
3. Prüfe Redis PubSub

### Health Check schlägt fehl

```bash
# Detailed Health Check
curl http://localhost:3020/api/v1/health/detailed
```

---

**Version:** 1.0.0  
**Maintainer:** MOJO Institut  
**Port:** 3020
