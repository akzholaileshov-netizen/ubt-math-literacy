const TOKEN_PATTERN = /^\d+:[A-Za-z0-9_-]+$/;

/**
 * Read the BotFather token from TELEGRAM_BOT_TOKEN only.
 * The value is never echoed in the error, and no other variable is consulted.
 */
export function readTelegramToken(env: { TELEGRAM_BOT_TOKEN?: string }): string {
  const raw = env.TELEGRAM_BOT_TOKEN;
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(
      'TELEGRAM_BOT_TOKEN is not set. Create a bot with BotFather and export the token in the shell. Do not commit it.',
    );
  }
  const token = raw.trim();
  if (!TOKEN_PATTERN.test(token)) {
    throw new Error('TELEGRAM_BOT_TOKEN is invalid. Expected the token BotFather shows.');
  }
  return token;
}

/** Remove a secret from a log line. */
export function redactSecret(message: string, secret: string): string {
  if (!secret) return message;
  return message.split(secret).join('<token>');
}
