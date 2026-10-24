import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { promptHidden } from '../src/utils/terminal.js';

test('hidden terminal prompt captures password without echoing it', async () => {
  const input = new EventEmitter();
  input.isTTY = true;
  input.rawMode = false;
  input.setRawMode = (enabled) => { input.rawMode = enabled; };
  input.setEncoding = () => {};
  input.resume = () => {};
  input.pause = () => {};
  let output = '';

  const result = promptHidden('Password: ', { input, output: { write: (value) => { output += value; } } });
  input.emit('data', 'sensitive-password\r');

  assert.equal(await result, 'sensitive-password');
  assert.equal(output, 'Password: \n');
  assert.equal(input.rawMode, false);
});
