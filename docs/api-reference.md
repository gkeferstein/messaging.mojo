# MOJO Messaging - REST API Reference

## Base URL

```
Production: https://messaging.mojo-institut.de/api/v1
Development: http://localhost:3020/api/v1
```

## Authentication

All endpoints (except health checks) require a Clerk JWT token:

```
Authorization: Bearer <clerk-jwt>
```

Optional tenant context via header:
```
X-Tenant-ID: <clerk-org-id>
```

---

## Health Endpoints

### GET /health

Simple health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-29T10:00:00.000Z",
  "service": "messaging.mojo"
}
```

### GET /health/detailed

Detailed health check with service status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-29T10:00:00.000Z",
  "service": "messaging.mojo",
  "checks": {
    "database": { "status": "healthy", "latency": 5 },
    "redis": { "status": "healthy", "latency": 2 }
  }
}
```

### GET /ready

Kubernetes readiness probe.

### GET /live

Kubernetes liveness probe.

---

## Conversation Endpoints

### GET /conversations

Get all conversations for the authenticated user.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Max items (1-100) |
| `cursor` | string | - | Pagination cursor |

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "type": "DIRECT",
      "name": null,
      "description": null,
      "avatarUrl": null,
      "participants": [
        {
          "userId": "user_xxx",
          "tenantId": "org_xxx",
          "role": "MEMBER",
          "name": "Max Mustermann",
          "avatarUrl": "https://...",
          "isOnline": true,
          "lastSeenAt": "2024-12-29T10:00:00.000Z"
        }
      ],
      "lastMessage": {
        "id": "uuid",
        "senderId": "user_xxx",
        "content": "Hello!",
        "type": "TEXT",
        "createdAt": "2024-12-29T10:00:00.000Z"
      },
      "unreadCount": 3,
      "createdAt": "2024-12-29T09:00:00.000Z",
      "updatedAt": "2024-12-29T10:00:00.000Z"
    }
  ],
  "totalUnread": 5,
  "nextCursor": "2024-12-29T09:00:00.000Z"
}
```

### POST /conversations

Create a new conversation.

**Request Body:**
```json
{
  "type": "DIRECT",
  "name": "Optional name (for groups)",
  "description": "Optional description",
  "participantIds": ["user_xxx", "user_yyy"]
}
```

**Type Options:**
- `DIRECT` - 1:1 conversation
- `GROUP` - Group chat
- `SUPPORT` - Support channel

**Response:** `201 Created`
```json
{
  "conversation": { ... }
}
```

**Errors:**
- `400` - Validation error
- `403` - Permission denied

### GET /conversations/:id

Get a specific conversation.

**Response:**
```json
{
  "conversation": { ... }
}
```

### GET /conversations/:id/participants

Get participants of a conversation.

**Response:**
```json
{
  "participants": [
    {
      "userId": "user_xxx",
      "tenantId": "org_xxx",
      "role": "OWNER",
      "name": "Max Mustermann",
      "avatarUrl": "https://...",
      "isOnline": true,
      "lastSeenAt": "2024-12-29T10:00:00.000Z"
    }
  ]
}
```

### POST /conversations/:id/read

Mark conversation as read.

**Response:**
```json
{
  "success": true
}
```

---

## Message Endpoints

### GET /conversations/:conversationId/messages

Get messages in a conversation.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Max items (1-100) |
| `cursor` | string | - | Pagination cursor |

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "conversationId": "uuid",
      "senderId": "user_xxx",
      "content": "Hello!",
      "type": "TEXT",
      "attachmentUrl": null,
      "attachmentType": null,
      "attachmentName": null,
      "replyToId": null,
      "createdAt": "2024-12-29T10:00:00.000Z",
      "editedAt": null,
      "deletedAt": null,
      "sender": {
        "name": "Max Mustermann",
        "avatarUrl": "https://..."
      }
    }
  ],
  "hasMore": true,
  "nextCursor": "2024-12-29T09:00:00.000Z"
}
```

### POST /conversations/:conversationId/messages

Send a message.

**Request Body:**
```json
{
  "content": "Hello!",
  "type": "TEXT",
  "replyToId": "optional-uuid",
  "attachmentUrl": "https://...",
  "attachmentType": "image/png",
  "attachmentName": "screenshot.png"
}
```

**Response:** `201 Created`
```json
{
  "message": { ... }
}
```

### GET /messages/unread

Get total unread message count.

**Response:**
```json
{
  "unreadCount": 5
}
```

---

## Contact Endpoints

### GET /contacts/requests

Get received contact requests.

**Response:**
```json
{
  "requests": [
    {
      "id": "uuid",
      "fromUserId": "user_xxx",
      "toUserId": "user_yyy",
      "ruleId": "cross-org-managers",
      "status": "PENDING",
      "message": "Hi, ich möchte Sie kontaktieren...",
      "createdAt": "2024-12-29T10:00:00.000Z",
      "expiresAt": "2025-01-05T10:00:00.000Z",
      "fromUser": {
        "id": "user_xxx",
        "name": "Max Mustermann",
        "email": "max@example.com",
        "avatarUrl": "https://..."
      }
    }
  ]
}
```

### GET /contacts/requests/sent

Get sent contact requests.

### POST /contacts/requests

Send a contact request.

**Request Body:**
```json
{
  "toUserId": "user_xxx",
  "message": "Hallo, ich würde Sie gerne kontaktieren."
}
```

**Response:** `201 Created`
```json
{
  "contactRequest": { ... }
}
```

**Errors:**
- `400` - Request not required (already allowed)
- `400` - Request already pending
- `403` - Permission denied

### POST /contacts/requests/:id/respond

Respond to a contact request.

**Request Body:**
```json
{
  "action": "accept"
}
```

Action options: `accept`, `decline`

### POST /contacts/block

Block a user.

**Request Body:**
```json
{
  "userId": "user_xxx",
  "reason": "Optional reason"
}
```

### DELETE /contacts/block/:userId

Unblock a user.

### GET /contacts/blocked

Get list of blocked users.

### GET /contacts/can-message/:userId

Check if you can message a user.

**Response:**
```json
{
  "canMessage": false,
  "requiresApproval": true,
  "reason": "Contact request required"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable message",
  "details": { ... }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request / Validation Error |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not Found |
| `429` | Too Many Requests |
| `500` | Internal Server Error |

---

## Rate Limiting

Default: 100 requests per minute per IP.

Headers:
- `X-RateLimit-Limit`: Max requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp


