const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function runPreview(t, overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jsg-preview-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const log = path.join(directory, 'commands');
  const commands = {
    ruby: '#!/bin/sh\nprintf "%s" "$RUBY_ARCH"\n',
    uname: '#!/bin/sh\nprintf "%s\\n" "$TEST_OS"\n',
    bundle: `#!/bin/sh
printf '%s|%s|%s|%s\\n' "$*" "$BUNDLE_PATH" "$BUNDLE_FROZEN" "\${CONFIGURE_ARGS:-}" >> "$COMMAND_LOG"
case "$1" in
  check) exit "$CHECK_STATUS" ;;
  install) exit "$INSTALL_STATUS" ;;
esac
`,
    docker: '#!/bin/sh\nexit 99\n',
  };
  for (const [name, contents] of Object.entries(commands)) {
    fs.writeFileSync(path.join(directory, name), contents, { mode: 0o755 });
  }
  const result = spawnSync('/bin/sh', [path.join(root, 'scripts/preview.sh')], {
    cwd: directory,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${directory}:/usr/bin:/bin`,
      COMMAND_LOG: log,
      TEST_OS: 'Linux',
      RUBY_ARCH: 'x86_64',
      CHECK_STATUS: '0',
      INSTALL_STATUS: '0',
      PREVIEW_PORT: '',
      CONFIGURE_ARGS: '',
      ...overrides,
    },
  });
  return {
    ...result,
    commands: fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [],
  };
}

test('native preview reuses local dependencies and serves the selected port', (t) => {
  const result = runPreview(t, { PREVIEW_PORT: '4001' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.commands, [
    `check|${root}/vendor/bundle|true|`,
    `exec jekyll serve --host 127.0.0.1 --port 4001 --force_polling|${root}/vendor/bundle|true|`,
  ]);
});

test('first native preview installs dependencies with the Ruby architecture on macOS', (t) => {
  const result = runPreview(t, {
    TEST_OS: 'Darwin',
    CHECK_STATUS: '1',
    CONFIGURE_ARGS: '--with-openssl-dir=/custom/openssl',
  });
  assert.equal(result.status, 0, result.stderr);
  const settings = `${root}/vendor/bundle|true|--with-openssl-dir=/custom/openssl --with-arch_flag='-arch x86_64'`;
  assert.deepEqual(result.commands, [
    `check|${settings}`,
    `install --jobs 2|${settings}`,
    `exec jekyll serve --host 127.0.0.1 --port 4000 --force_polling|${settings}`,
  ]);
});

test('dependency installation failure stops the preview without starting a server', (t) => {
  const result = runPreview(t, { CHECK_STATUS: '1', INSTALL_STATUS: '23' });
  assert.equal(result.status, 23);
  assert.equal(result.commands.length, 2);
  assert.ok(result.commands[1].startsWith('install --jobs 2|'));
});
