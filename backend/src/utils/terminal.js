import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

export async function promptHidden(prompt, { input = stdin, output = stdout } = {}) {
  output.write(prompt);
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    const reader = createInterface({ input, output, terminal: false });
    try {
      return await reader.question('');
    } finally {
      reader.close();
    }
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      input.removeListener('data', onData);
      input.removeListener('error', onError);
      input.setRawMode(false);
      input.pause();
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup();
          output.write('\n');
          reject(new Error('Password entry cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          output.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u0008' || character === '\u007f') {
          value = Array.from(value).slice(0, -1).join('');
        } else if (character >= ' ') {
          value += character;
        }
      }
    };

    input.setEncoding('utf8');
    input.setRawMode(true);
    input.on('data', onData);
    input.once('error', onError);
    input.resume();
  });
}
