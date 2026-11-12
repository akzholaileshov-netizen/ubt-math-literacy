export type TelegramChat = { id: number; type?: string };

export type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: TelegramChat;
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: TelegramChat };
  };
};

export type Incoming =
  | { type: 'command'; chatId: number; command: string }
  | { type: 'text'; chatId: number; text: string }
  | { type: 'callback'; chatId: number; callbackId: string; data: string };

const COMMAND = /^\/([A-Za-z0-9_]+)(?:@[A-Za-z0-9_]+)?(?:\s|$)/;

export function commandName(text: string): string | null {
  const match = text.trim().match(COMMAND);
  if (!match?.[1]) return null;
  return match[1].toLowerCase();
}

/** Latin A–D, optionally followed by ) or . The buttons use the same letters. */
export function choiceFromText(text: string): 0 | 1 | 2 | 3 | null {
  const match = text.trim().match(/^([A-Da-d])(?:[.)])?$/);
  if (!match?.[1]) return null;
  return (match[1].toUpperCase().charCodeAt(0) - 65) as 0 | 1 | 2 | 3;
}

export function incomingFromUpdate(update: TelegramUpdate): Incoming | null {
  const callback = update.callback_query;
  if (callback) {
    const chat = callback.message?.chat;
    if (!chat || !isPrivate(chat) || !isChatId(chat.id) || typeof callback.id !== 'string') return null;
    return {
      type: 'callback',
      chatId: chat.id,
      callbackId: callback.id,
      data: typeof callback.data === 'string' ? callback.data : '',
    };
  }
  const message = update.message;
  if (!message || !isPrivate(message.chat) || !isChatId(message.chat.id)) return null;
  if (typeof message.text !== 'string') return null;
  const command = commandName(message.text);
  if (command) return { type: 'command', chatId: message.chat.id, command };
  return { type: 'text', chatId: message.chat.id, text: message.text };
}

function isPrivate(chat: TelegramChat): boolean {
  return chat.type === undefined || chat.type === 'private';
}

function isChatId(id: number): boolean {
  return typeof id === 'number' && Number.isFinite(id);
}
