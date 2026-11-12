import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { posixRemote } from '../src/envs.js';

test('remote commands run under sh, whatever the login shell', () => {
  const cmd = posixRemote('echo out; echo err >&2; true && exit 3');
  assert.equal(cmd, "sh -c 'echo out; echo err >&2; true && exit 3'");
  assert.throws(() => posixRemote("echo 'x'"), /single quote/);
  for (const shell of ['bash', 'nu']) {
    const r = spawnSync(shell, ['-c', cmd], { encoding: 'utf8' });
    if (r.error) continue; // shell not installed here
    assert.equal(r.status, 3, `${shell}: ${r.stderr}`);
    assert.equal(r.stdout.trim(), 'out');
    assert.equal(r.stderr.trim(), 'err');
  }
});
