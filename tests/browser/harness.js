'use strict';

// Shared helpers for the Firefox browser tests. A local server serves a
// fixture that mimics the Google Images structure and collects reports from
// both the fixture's own script and the extension under test. `web-ext run`
// loads the extension as a temporary add-on, so no WebDriver is involved.

const { execFileSync, spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const webExt = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'web-ext');

// The search field sits outside #center_col; the gallery (#rso) and pagination
// (#botstuff) sit inside it, matching the structure the extension targets.
function fixtureHtml(pageScript) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>fixture</title></head>
<body>
<form id="search"><input id="searchbox" name="q" value=""></form>
<div id="center_col"><div id="rso">gallery</div><div id="botstuff">pagination</div></div>
<script>${pageScript}</script>
</body></html>`;
}

function startServer(pageScript) {
  const reports = [];
  const waiters = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/__report') {
      const report = JSON.parse(url.searchParams.get('data'));
      reports.push(report);
      waiters.splice(0).forEach((resolve) => resolve());
      response.writeHead(204).end();
      return;
    }
    if (url.pathname === '/search') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(fixtureHtml(pageScript));
      return;
    }
    response.writeHead(404).end();
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        origin: `http://127.0.0.1:${server.address().port}`,
        reports,
        close: () => server.close(),
        // Resolves once a report satisfying `predicate` arrives.
        async waitForReport(predicate, timeoutMs) {
          const deadline = Date.now() + timeoutMs;
          while (!reports.some(predicate)) {
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
              throw new Error('timed out waiting for a report');
            }
            await new Promise((resolveWait) => {
              waiters.push(resolveWait);
              setTimeout(resolveWait, Math.min(remaining, 250));
            });
          }
        },
      });
    });
  });
}

function firefoxBinary() {
  return process.env.FIREFOX_BINARY || 'firefox';
}

function firefoxVersion() {
  const output = execFileSync(firefoxBinary(), ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return output.trim().split('\n').at(-1);
}

// Starts headless Firefox with `sourceDir` loaded as a temporary add-on and
// returns a function that stops it.
function launchFirefox(sourceDir, startUrl) {
  const child = spawn(
    webExt,
    [
      'run',
      '--source-dir', sourceDir,
      '--firefox', firefoxBinary(),
      '--arg=-headless',
      '--start-url', startUrl,
      '--no-input',
      '--no-reload',
    ],
    { detached: true, stdio: 'ignore' },
  );
  return () => {
    try {
      process.kill(-child.pid);
    } catch {
      // Already exited.
    }
  };
}

module.exports = { firefoxVersion, launchFirefox, startServer };
