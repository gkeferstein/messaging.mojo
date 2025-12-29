# MOJO Messaging Widget - Implementation Standards

Diese Dokumentation beschreibt die Standards für die Integration des Messaging-Widgets in MOJO-Apps.

## Wichtig: Kein Shared Package!

Das Messaging-Widget wird **nicht** als Shared Package bereitgestellt. Jede App implementiert ihr eigenes Widget basierend auf dieser Dokumentation.

**Gründe:**
- ✅ Fehlertoleranz - Ein Bug hier crasht nicht alle Apps
- ✅ Unabhängiges Deployment - Apps können unabhängig deployen
- ✅ API-Versionierung - Breaking Changes kontrollierbar
- ✅ Lose Kopplung - Apps bleiben eigenständig

---

## Position & Layout

### Position in Top-Bar

Das Widget MUSS in der Top-Bar rechts platziert werden.

**Reihenfolge (von links nach rechts):**
```
[App-Switcher] ... [Search] ... [Messaging] [Notifications] [Tenant-Switcher] [User-Menu]
```

### Icon

- **Lucide Icon:** `MessageCircle`
- **Größe:** 20x20px (`h-5 w-5`)
- **Alternative:** Eigenes Icon mit ähnlicher Semantik

---

## Badge (Ungelesen-Zähler)

### Position
- Oben-rechts am Icon
- Überlappt das Icon leicht

### Style
- **Form:** Rund
- **Farbe:** Primary (MOJO Green `#66dd99`)
- **Text:** Weiß, Font-Size 10-12px
- **Min-Width:** 18px
- **Height:** 18px

### Verhalten
- Zeigt Zahl 1-99
- Bei >99 zeigt "99+"
- Versteckt bei 0

### CSS
```css
.messaging-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background-color: var(--color-primary);
  color: var(--color-primary-foreground);
  font-size: 11px;
  font-weight: 500;
  padding: 0 4px;
}
```

---

## Dropdown

### Trigger
- Klick auf Icon öffnet Dropdown
- Klick außerhalb schließt

### Dimensionen
- **Breite:** 320px (`w-80`)
- **Max-Höhe:** 384px (`max-h-96`)
- **Position:** Rechts ausgerichtet

### Struktur
```
┌────────────────────────────────────┐
│  Nachrichten                    ✕  │  ← Header
├────────────────────────────────────┤
│  ┌──┐  Max Müller         vor 2m  │
│  │  │  Hey, hast du kurz...       │  ← Conversation Item
│  └──┘                              │
├────────────────────────────────────┤
│  ... (max 5 Items)                 │
├────────────────────────────────────┤
│     Alle Nachrichten öffnen        │  ← Footer
└────────────────────────────────────┘
```

### Header
- Titel: "Nachrichten"
- Close-Button (X) rechts

### Conversation List
- Max 5 Items anzeigen
- Sortiert nach `updatedAt` (neueste zuerst)
- Scrollbar bei mehr Content

### Footer
- Link zu `https://messaging.mojo-institut.de`
- Text: "Alle Nachrichten öffnen"
- Öffnet in neuem Tab oder navigiert

---

## Conversation Item

### Layout
```
┌────────────────────────────────────────────────────┐
│  ┌──────┐                                          │
│  │Avatar│  Name                         Zeitstempel│
│  │ ●    │  Preview-Text...                   [3]  │
│  └──────┘                                          │
└────────────────────────────────────────────────────┘
```

### Avatar
- **Größe:** 40x40px
- **Form:** Rund
- **Fallback:** Initialen auf Primary/10 Hintergrund

### Online-Status
- **Grüner Punkt:** 10px, unten-rechts am Avatar
- **Nur wenn online:** `isOnline === true`

### Name
- Max 1 Zeile, truncate mit `...`
- Bei `unreadCount > 0`: **fett**

### Preview
- Letzte Nachricht, max 1 Zeile
- Truncate mit `...`
- Grau bei gelesen, normal bei ungelesen

### Zeitstempel
- Relativ: "gerade", "vor 5 Min", "vor 1 Std", "gestern", "vor 3 T"
- Font-Size kleiner, grau

### Unread-Badge
- Rechts am Item
- Rund, Primary-Farbe
- Zahl 1-99

---

## Verbindungsstatus

### Online (verbunden)
- Keine visuelle Anzeige nötig

### Offline (getrennt)
- **Roter Punkt** (6px) unten-rechts am Icon
- Zeigt: WebSocket nicht verbunden

### Reconnecting
- Optional: Pulsierender Punkt

---

## Graceful Degradation

Das Widget DARF NIEMALS die Host-App crashen!

### Bei API-Fehler
```javascript
try {
  const data = await fetchConversations();
  setConversations(data);
} catch (error) {
  console.error('[Messaging] API Error:', error);
  // Option 1: Widget ausblenden
  setShowWidget(false);
  // Option 2: Fallback-UI
  setError('Nicht verfügbar');
}
```

### Bei WebSocket-Fehler
```javascript
socket.on('connect_error', (error) => {
  console.error('[Messaging] WebSocket Error:', error);
  // Nicht crashen, nur offline markieren
  setIsConnected(false);
});
```

### Bei Render-Fehler
```jsx
// React Error Boundary
<ErrorBoundary fallback={null}>
  <MessagingWidget />
</ErrorBoundary>
```

---

## Performance

### Lazy Loading
Widget-Code erst bei erster Interaktion vollständig laden:

```jsx
const MessagingWidget = lazy(() => import('./MessagingWidget'));

function Header() {
  return (
    <Suspense fallback={<MessagingIconPlaceholder />}>
      <MessagingWidget />
    </Suspense>
  );
}
```

### WebSocket Connection
- Erst verbinden wenn Widget sichtbar
- Disconnect wenn App im Hintergrund (Page Visibility API)

### Polling Fallback
Falls WebSocket nicht verfügbar:
- Unread-Count alle 30 Sekunden pollen
- Nachrichten nicht live, nur bei Dropdown-Öffnung

### Debouncing
- Typing-Events: 300ms debounce
- Unread-Fetch: 1s debounce

---

## TypeScript Types

Kopiere diese Types in dein Projekt:

```typescript
// src/types/messaging.ts

// ============================================
// MOJO Messaging Types v1.0.0
// API: https://messaging.mojo-institut.de/api/v1
// ============================================

export interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP' | 'SUPPORT' | 'ANNOUNCEMENT';
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  participants: Participant[];
  lastMessage: Message | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'TEXT' | 'SYSTEM' | 'ATTACHMENT';
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentName: string | null;
  replyToId: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender?: {
    name: string;
    avatarUrl?: string;
  };
}

export interface Participant {
  userId: string;
  tenantId: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  name?: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeenAt?: string;
}

// API Responses
export interface ConversationsResponse {
  conversations: Conversation[];
  totalUnread: number;
  nextCursor?: string;
}

export interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface UnreadResponse {
  unreadCount: number;
}

// WebSocket Events (Client → Server)
export type ClientToServerEvent =
  | { event: 'message:send'; data: { conversationId: string; content: string; type?: 'TEXT' } }
  | { event: 'typing:start'; data: { conversationId: string } }
  | { event: 'typing:stop'; data: { conversationId: string } }
  | { event: 'messages:read'; data: { conversationId: string } }
  | { event: 'conversation:join'; data: { conversationId: string } }
  | { event: 'conversation:leave'; data: { conversationId: string } }
  | { event: 'presence:get'; data: {} };

// WebSocket Events (Server → Client)
export type ServerToClientEvent =
  | { event: 'message:new'; data: { message: Message; conversationId: string } }
  | { event: 'message:sent'; data: { messageId: string; conversationId: string; timestamp: string } }
  | { event: 'message:error'; data: { error: string; conversationId: string } }
  | { event: 'typing:update'; data: { userId: string; conversationId: string; isTyping: boolean } }
  | { event: 'messages:read'; data: { userId: string; conversationId: string; readAt: string } }
  | { event: 'presence:online'; data: { userId: string; tenantId?: string; timestamp: string } }
  | { event: 'presence:offline'; data: { userId: string; tenantId?: string; lastSeen: string } }
  | { event: 'presence:list'; data: { tenantId?: string; onlineUsers: string[] } };

// Helper Type for Socket.io
export interface ServerToClientEvents {
  'message:new': (data: { message: Message; conversationId: string }) => void;
  'message:sent': (data: { messageId: string; conversationId: string; timestamp: string }) => void;
  'message:error': (data: { error: string; conversationId: string }) => void;
  'typing:update': (data: { userId: string; conversationId: string; isTyping: boolean }) => void;
  'messages:read': (data: { userId: string; conversationId: string; readAt: string }) => void;
  'presence:online': (data: { userId: string; tenantId?: string; timestamp: string }) => void;
  'presence:offline': (data: { userId: string; tenantId?: string; lastSeen: string }) => void;
  'presence:list': (data: { tenantId?: string; onlineUsers: string[] }) => void;
}

export interface ClientToServerEvents {
  'message:send': (data: { conversationId: string; content: string; type?: 'TEXT' }) => void;
  'typing:start': (data: { conversationId: string }) => void;
  'typing:stop': (data: { conversationId: string }) => void;
  'messages:read': (data: { conversationId: string }) => void;
  'conversation:join': (data: { conversationId: string }) => void;
  'conversation:leave': (data: { conversationId: string }) => void;
  'presence:get': () => void;
}
```

---

## Example Implementation

Vollständiges Widget-Beispiel:

```tsx
// src/components/MessagingWidget.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { io, Socket } from 'socket.io-client';
import type { 
  Conversation, 
  ConversationsResponse,
  ServerToClientEvents,
  ClientToServerEvents 
} from '@/types/messaging';

const MESSAGING_API = process.env.NEXT_PUBLIC_MESSAGING_API_URL || 'https://messaging.mojo-institut.de';
const MESSAGING_WS = process.env.NEXT_PUBLIC_MESSAGING_WS_URL || 'wss://messaging.mojo-institut.de';

export function MessagingWidget() {
  const { getToken } = useAuth();
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load conversations
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const token = await getToken();
        if (!token || !mounted) return;

        const res = await fetch(`${MESSAGING_API}/api/v1/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data: ConversationsResponse = await res.json();
        if (mounted) {
          setConversations(data.conversations);
          setTotalUnread(data.totalUnread);
        }
      } catch (err) {
        console.error('[Messaging] Load error:', err);
        if (mounted) setError('Nicht verfügbar');
      }
    }

    load();
    return () => { mounted = false; };
  }, [getToken]);

  // WebSocket connection
  useEffect(() => {
    let ws: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

    async function connect() {
      try {
        const token = await getToken();
        if (!token) return;

        ws = io(MESSAGING_WS, {
          auth: { token },
          transports: ['websocket'],
          reconnection: true,
        });

        ws.on('connect', () => setIsConnected(true));
        ws.on('disconnect', () => setIsConnected(false));

        ws.on('message:new', ({ message, conversationId }) => {
          setConversations(prev =>
            prev.map(c =>
              c.id === conversationId
                ? { ...c, lastMessage: message, unreadCount: c.unreadCount + 1 }
                : c
            )
          );
          setTotalUnread(prev => prev + 1);
        });

        setSocket(ws);
      } catch (err) {
        console.error('[Messaging] WS error:', err);
      }
    }

    connect();
    return () => { ws?.close(); };
  }, [getToken]);

  // Don't render on error
  if (error) return null;

  const sortedConversations = [...conversations]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent transition-colors"
        aria-label={`Nachrichten${totalUnread > 0 ? ` (${totalUnread} ungelesen)` : ''}`}
      >
        <MessageCircle className="h-5 w-5" />
        
        {/* Unread Badge */}
        {totalUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-medium text-primary-foreground">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
        
        {/* Offline Indicator */}
        {!isConnected && (
          <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-destructive" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border bg-popover shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">Nachrichten</span>
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto">
              {sortedConversations.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Keine Nachrichten
                </div>
              ) : (
                sortedConversations.map(conv => (
                  <ConversationItem key={conv.id} conversation={conv} />
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-4 py-3 text-center">
              <a
                href={MESSAGING_API}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Alle Nachrichten öffnen
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ConversationItem({ conversation }: { conversation: Conversation }) {
  const other = conversation.participants[0];
  const displayName = conversation.name || other?.name || 'Unbekannt';

  return (
    <a
      href={`${MESSAGING_API}/chat/${conversation.id}`}
      className="flex gap-3 border-b px-4 py-3 hover:bg-accent transition-colors"
    >
      {/* Avatar */}
      <div className="relative h-10 w-10 flex-shrink-0">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/10">
          {other?.avatarUrl ? (
            <img src={other.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <span className="text-sm font-medium text-primary">
              {displayName[0]?.toUpperCase() || '?'}
            </span>
          )}
        </div>
        {other?.isOnline && (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-popover bg-green-500" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className={`truncate text-sm ${conversation.unreadCount > 0 ? 'font-semibold' : ''}`}>
            {displayName}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTimeAgo(conversation.lastMessage?.createdAt)}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {conversation.lastMessage?.content || 'Keine Nachrichten'}
        </p>
      </div>

      {/* Unread Badge */}
      {conversation.unreadCount > 0 && (
        <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {conversation.unreadCount}
        </span>
      )}
    </a>
  );
}

function formatTimeAgo(date?: string): string {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'gerade';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} Min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} Std`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} T`;
  return new Date(date).toLocaleDateString('de-DE');
}
```

---

## Checklist für Integration

- [ ] Widget in Top-Bar rechts platziert
- [ ] MessageCircle Icon verwendet
- [ ] Unread-Badge implementiert
- [ ] Dropdown mit 5 letzten Konversationen
- [ ] Online-Status Punkt am Avatar
- [ ] Offline-Indicator am Icon
- [ ] Graceful Degradation bei Fehlern
- [ ] TypeScript Types kopiert
- [ ] Environment Variables gesetzt
- [ ] Error Boundary um Widget


