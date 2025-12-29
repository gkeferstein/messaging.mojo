# MOJO Messaging - WebSocket Events Reference

## Connection

### URL

```
Production: wss://messaging.mojo-institut.de
Development: ws://localhost:3020
```

### Authentication

Provide Clerk JWT in the `auth` object:

```javascript
import { io } from 'socket.io-client';

const socket = io('wss://messaging.mojo-institut.de', {
  auth: {
    token: clerkJWT,           // Required: Clerk session token
    tenantId: 'org_xxx'        // Optional: Active organization
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
```

### Connection Events

```javascript
socket.on('connect', () => {
  console.log('Connected!', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
```

---

## Client → Server Events

### message:send

Send a message to a conversation.

```javascript
socket.emit('message:send', {
  conversationId: 'uuid',
  content: 'Hello!',
  type: 'TEXT',           // Optional: TEXT, SYSTEM, ATTACHMENT
  replyToId: 'uuid'       // Optional: Reply to message
});
```

### typing:start

Start typing indicator.

```javascript
socket.emit('typing:start', {
  conversationId: 'uuid'
});
```

### typing:stop

Stop typing indicator.

```javascript
socket.emit('typing:stop', {
  conversationId: 'uuid'
});
```

### messages:read

Mark messages as read.

```javascript
socket.emit('messages:read', {
  conversationId: 'uuid',
  lastReadAt: new Date().toISOString()  // Optional
});
```

### conversation:join

Explicitly join a conversation room.

```javascript
socket.emit('conversation:join', {
  conversationId: 'uuid'
});
```

### conversation:leave

Leave a conversation room.

```javascript
socket.emit('conversation:leave', {
  conversationId: 'uuid'
});
```

### presence:get

Get online users in current tenant.

```javascript
socket.emit('presence:get');
```

---

## Server → Client Events

### message:new

New message received.

```javascript
socket.on('message:new', (data) => {
  const { message, conversationId } = data;
  
  // message object:
  // {
  //   id: 'uuid',
  //   conversationId: 'uuid',
  //   senderId: 'user_xxx',
  //   content: 'Hello!',
  //   type: 'TEXT',
  //   createdAt: '2024-12-29T10:00:00.000Z',
  //   sender: {
  //     name: 'Max Mustermann',
  //     avatarUrl: 'https://...'
  //   }
  // }
});
```

### message:sent

Acknowledgment that message was sent.

```javascript
socket.on('message:sent', (data) => {
  const { messageId, conversationId, timestamp } = data;
});
```

### message:error

Error sending message.

```javascript
socket.on('message:error', (data) => {
  const { error, conversationId } = data;
  console.error('Failed to send:', error);
});
```

### typing:update

Typing indicator update.

```javascript
socket.on('typing:update', (data) => {
  const { userId, conversationId, isTyping } = data;
  
  if (isTyping) {
    showTypingIndicator(userId);
  } else {
    hideTypingIndicator(userId);
  }
});
```

### messages:read

Someone read messages.

```javascript
socket.on('messages:read', (data) => {
  const { userId, conversationId, readAt } = data;
  updateReadReceipts(conversationId, userId, readAt);
});
```

### presence:online

User came online.

```javascript
socket.on('presence:online', (data) => {
  const { userId, tenantId, timestamp } = data;
  markUserOnline(userId);
});
```

### presence:offline

User went offline.

```javascript
socket.on('presence:offline', (data) => {
  const { userId, tenantId, lastSeen } = data;
  markUserOffline(userId, lastSeen);
});
```

### presence:list

List of online users (response to `presence:get`).

```javascript
socket.on('presence:list', (data) => {
  const { tenantId, onlineUsers } = data;
  // onlineUsers: ['user_xxx', 'user_yyy']
});
```

### conversation:joined

Joined a conversation room.

```javascript
socket.on('conversation:joined', (data) => {
  const { conversationId } = data;
});
```

### conversation:left

Left a conversation room.

```javascript
socket.on('conversation:left', (data) => {
  const { conversationId } = data;
});
```

### conversation:error

Error with conversation action.

```javascript
socket.on('conversation:error', (data) => {
  const { error, conversationId } = data;
});
```

---

## Example Implementation

### React Hook

```typescript
import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  createdAt: string;
  sender?: {
    name: string;
    avatarUrl?: string;
  };
}

export function useMessaging(token: string, tenantId?: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_MESSAGING_WS_URL!, {
      auth: { token, tenantId },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    newSocket.on('message:new', (data) => {
      setMessages((prev) => [data.message, ...prev]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token, tenantId]);

  const sendMessage = useCallback(
    (conversationId: string, content: string) => {
      socket?.emit('message:send', { conversationId, content });
    },
    [socket]
  );

  const startTyping = useCallback(
    (conversationId: string) => {
      socket?.emit('typing:start', { conversationId });
      
      // Auto-stop after 3 seconds
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        socket?.emit('typing:stop', { conversationId });
      }, 3000);
    },
    [socket]
  );

  const markAsRead = useCallback(
    (conversationId: string) => {
      socket?.emit('messages:read', { conversationId });
    },
    [socket]
  );

  return {
    socket,
    isConnected,
    messages,
    sendMessage,
    startTyping,
    markAsRead,
  };
}
```

---

## Rooms

The server automatically manages rooms:

| Room | Description |
|------|-------------|
| `user:{userId}` | User-specific room (for DMs) |
| `tenant:{tenantId}` | Tenant/org room (for presence) |
| `conversation:{id}` | Conversation room |

Users automatically join:
- Their user room on connect
- Their tenant room (if `tenantId` provided)
- All their conversation rooms

---

## Best Practices

1. **Typing Debounce**: Don't emit `typing:start` on every keystroke
   ```javascript
   const debouncedTyping = debounce((convId) => {
     socket.emit('typing:start', { conversationId: convId });
   }, 300);
   ```

2. **Reconnection Handling**: Re-fetch data on reconnect
   ```javascript
   socket.on('connect', () => {
     if (wasConnected) {
       fetchUnreadMessages();
     }
   });
   ```

3. **Optimistic Updates**: Update UI immediately, then sync
   ```javascript
   // Add message to UI
   addMessageOptimistically(newMessage);
   
   // Send to server
   socket.emit('message:send', newMessage);
   
   // Handle error
   socket.on('message:error', (err) => {
     removeOptimisticMessage(newMessage);
     showError(err);
   });
   ```

4. **Graceful Degradation**: Don't crash if socket fails
   ```javascript
   try {
     socket.emit('message:send', data);
   } catch {
     // Fallback to REST API
     await fetch('/api/v1/messages', { ... });
   }
   ```


