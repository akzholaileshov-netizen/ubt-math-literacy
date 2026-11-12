import { runBot } from './poll';
import { redactSecret, readTelegramToken } from './token';

type NodeProcess = {
  env: Record<string, string | undefined>;
  exit: (code?: number) => never;
  on: (event: 'SIGINT' | 'SIGTERM', listener: () => void) => void;
};

function nodeProcess(): NodeProcess {
  const candidate = (globalThis as { process?: NodeProcess }).process;
  if (!candidate?.env || typeof candidate.exit !== 'function' || typeof candidate.on !== 'function') {
    throw new Error('Node.js process is not available');
  }
  return candidate;
}

function readToken(node: NodeProcess): string {
  try {
    return readTelegramToken(node.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'TELEGRAM_BOT_TOKEN is not set');
    return node.exit(1);
  }
}

const proc = nodeProcess();
const token = readToken(proc);

const controller = new AbortController();
proc.on('SIGINT', () => controller.abort());
proc.on('SIGTERM', () => controller.abort());

runBot(token, controller.signal)
  .then(() => {
    proc.exit(0);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Telegram bot failed';
    console.error(redactSecret(message, token));
    proc.exit(1);
  });
