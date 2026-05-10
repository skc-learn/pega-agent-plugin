/**
 * Message Types - Typed Inter-Component Communication Protocol
 *
 * All messages between components use this typed protocol.
 * The service worker is the ONLY trust boundary.
 */

import {
  MessageType,
  type Message,
  type MessageMetadata,
} from './types';

// Re-export MessageType for convenience
export { MessageType };

/**
 * Create a standard message envelope
 */
export function createMessage<T>(
  type: MessageType,
  payload: T,
  metadata: Partial<MessageMetadata> = {}
): Message<T> {
  return {
    type,
    payload,
    metadata: {
      timestamp: Date.now(),
      ...metadata,
    },
  };
}

/**
 * Validate message structure
 */
export function isValidMessage(message: unknown): message is Message {
  if (!message || typeof message !== 'object') return false;

  const msg = message as Partial<Message>;

  if (!msg.type || !Object.values(MessageType).includes(msg.type)) {
    return false;
  }

  if (msg.payload === undefined) {
    return false;
  }

  return true;
}

/**
 * Type guard for specific message types
 */
export function isMessageType<T extends MessageType>(
  message: Message,
  type: T
): message is Message & { type: T } {
  return message.type === type;
}

/**
 * Generate a unique correlation ID for request/response tracking
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
