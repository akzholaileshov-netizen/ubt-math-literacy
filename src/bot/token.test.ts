import { describe, expect, it } from 'vitest';
import { redactSecret, readTelegramToken } from './token';

describe('TELEGRAM_BOT_TOKEN', () => {
  it('reads only a trimmed BotFather token', () => {
    expect(readTelegramToken({ TELEGRAM_BOT_TOKEN: '  123456:ABC_def-99  ' })).toBe('123456:ABC_def-99');
  });

  it('refuses a missing token without reading any other name', () => {
    const env: { TELEGRAM_BOT_TOKEN?: string } = {};
    expect(() => readTelegramToken(env)).toThrow(/TELEGRAM_BOT_TOKEN is not set/);
    expect(() => readTelegramToken({ TELEGRAM_BOT_TOKEN: '   ' })).toThrow(/TELEGRAM_BOT_TOKEN is not set/);
  });

  it('rejects a malformed token and does not echo the value', () => {
    const secret = 'not-a-real-token';
    try {
      readTelegramToken({ TELEGRAM_BOT_TOKEN: secret });
      expect.fail('expected an invalid token to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('TELEGRAM_BOT_TOKEN is invalid');
      expect((error as Error).message).not.toContain(secret);
    }
    expect(() => readTelegramToken({ TELEGRAM_BOT_TOKEN: '123:abc/def' })).toThrow(/invalid/);
  });

  it('strips the token out of log text', () => {
    const token = '123456:ABCDEF';
    expect(redactSecret(`Telegram failed for ${token}`, token)).toBe('Telegram failed for <token>');
    expect(redactSecret('no secret here', token)).toBe('no secret here');
  });
});
