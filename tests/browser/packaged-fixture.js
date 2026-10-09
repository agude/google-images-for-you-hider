'use strict';

// Loads the built XPI into Firefox and checks computed styles on a fixture
// across push, replace, traversal, DOM replacement, and page restoration.
//
// The fixture is served from 127.0.0.1, which the production manifest does
// not match. This script unpacks the XPI into a temporary directory and
// rewrites only content_scripts[0].matches to the fixture host; content.js and
// content.css are the packaged files, verified byte-for-byte. The distributable
// XPI never contains fixture hosts.
//
// Usage: just build && node tests/browser/packaged-fixture.js
// Set FIREFOX_BINARY to test a specific Firefox build. Set NO_BFCACHE=1 to
// disable the back/forward cache, so restoration reloads the page instead.

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { firefoxVersion, launchFirefox, startServer } = require('./harness');

const projectRoot = path.join(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'manifest.json'), 'utf8'));
const xpi = path.join(projectRoot, 'dist', `google-images-for-you-hider-${manifest.version}.xpi`);

function unpackForFixture() {
  const listing = execFileSync('unzip', ['-Z1', xpi], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .sort();
  assert.deepEqual(listing, ['content.css', 'content.js', 'manifest.json']);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'packaged-fixture-'));
  execFileSync('unzip', ['-q', xpi, '-d', directory]);
  for (const file of ['content.js', 'content.css']) {
    assert.deepEqual(
      fs.readFileSync(path.join(directory, file)),
      fs.readFileSync(path.join(projectRoot, file)),
      `${file} in the XPI differs from the source`,
    );
  }

  const packaged = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  packaged.content_scripts[0].matches = ['http://127.0.0.1/search*'];
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(packaged, null, 2));
  return directory;
}

const landing = '/search?udm=49&udf=257';
const typed = '/search?udm=49&udf=257&q=book+covers';
const emptyQuery = '/search?udm=49&udf=257&q=';
const pagination = '/search?udm=49&udf=257&start=10';

// `hidden` is the expected state of both sections after the action. A `leave`
// step navigates away and back; the expectation applies to the pageshow event
// that follows. `mutates` marks steps that replace the section elements.
const steps = [
  { name: 'landing load', action: null, url: landing, hidden: true },
  { name: 'push populated q', action: `history.pushState({}, '', '${typed}')`, url: typed, hidden: false },
  { name: 'push landing', action: `history.pushState({}, '', '${landing}')`, url: landing, hidden: true },
  { name: 'replace empty q', action: `history.replaceState({}, '', '${emptyQuery}')`, url: emptyQuery, hidden: false },
  { name: 'replace landing', action: `history.replaceState({}, '', '${landing}')`, url: landing, hidden: true },
  { name: 'traverse back', action: 'history.back()', url: typed, hidden: false },
  { name: 'traverse forward', action: 'history.forward()', url: landing, hidden: true },
  { name: 'push pagination', action: `history.pushState({}, '', '${pagination}')`, url: pagination, hidden: true },
  { name: 'new elements while hidden', action: 'replaceSections()', url: pagination, hidden: true, mutates: true },
  { name: 'push populated q again', action: `history.pushState({}, '', '${typed}')`, url: typed, hidden: false },
  { name: 'new elements while visible', action: 'replaceSections()', url: typed, hidden: false, mutates: true },
  { name: 'push landing, leave and restore', action: `history.pushState({}, '', '${landing}')`, url: landing, hidden: true, leave: true },
  { name: 'push populated q, leave and restore', action: `history.pushState({}, '', '${typed}')`, url: typed, hidden: false, leave: true },
];

const pageScript = `
const steps = ${JSON.stringify(steps)};
const report = (data) => fetch('/__report?' + new URLSearchParams({ data: JSON.stringify(data) }));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const display = (selector) => getComputedStyle(document.querySelector(selector)).display;
const styles = () => ({
  rso: display('#center_col #rso'),
  botstuff: display('#center_col #botstuff'),
  searchbox: display('#searchbox'),
});
function replaceSections() {
  for (const id of ['rso', 'botstuff']) {
    const replacement = document.createElement('div');
    replacement.id = id;
    replacement.textContent = 'new ' + id;
    document.getElementById(id).replaceWith(replacement);
  }
}
window.addEventListener('pageshow', async (event) => {
  await sleep(200);
  report({ kind: 'pageshow', persisted: event.persisted, url: location.pathname + location.search, styles: styles() });
});
(async () => {
  await sleep(1000);
  for (let index = Number(sessionStorage.getItem('next') || 0); index < steps.length; index += 1) {
    const step = steps[index];
    sessionStorage.setItem('next', String(index + 1));
    await report({ kind: 'step', name: step.name });
    if (step.action) new Function(step.action)();
    await sleep(400);
    if (step.leave) {
      location.href = '/elsewhere';
      await sleep(5000);
      continue;
    }
    await report({ kind: 'state', name: step.name, url: location.pathname + location.search, styles: styles() });
  }
  await report({ kind: 'done' });
})();
`;

const failures = [];

function check(label, observed, expectedUrl, hidden) {
  const { rso, botstuff, searchbox } = observed.styles;
  const hiddenNow = rso === 'none' && botstuff === 'none';
  const visibleNow = rso !== 'none' && botstuff !== 'none';
  const ok =
    observed.url === expectedUrl &&
    (hidden ? hiddenNow : visibleNow) &&
    searchbox !== 'none';
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${observed.url} rso=${rso} botstuff=${botstuff} searchbox=${searchbox}`);
  if (!ok) {
    failures.push(`${label}: expected ${hidden ? 'hidden' : 'visible'} at ${expectedUrl}`);
  }
}

async function main() {
  const server = await startServer(pageScript, {
    extraRoutes: {
      '/elsewhere': '<!doctype html><title>elsewhere</title><script>setTimeout(() => history.back(), 500)</script>',
    },
  });
  const stop = launchFirefox(unpackForFixture(), server.origin + landing, {
    preferences: process.env.NO_BFCACHE
      ? ['browser.sessionhistory.max_total_viewers=0']
      : [],
  });

  try {
    await server.waitForReport((report) => report.kind === 'done', 90000);
  } catch (error) {
    failures.push(`sequence did not finish: ${error.message}`);
  } finally {
    stop();
    server.close();
  }

  console.log(firefoxVersion());
  for (const step of steps) {
    if (step.leave) {
      const start = server.reports.findIndex((report) => report.name === step.name);
      const restored = server.reports
        .slice(start + 1)
        .find((report) => report.kind === 'pageshow');
      if (restored) {
        check(`${step.name} (persisted=${restored.persisted})`, restored, step.url, step.hidden);
      } else {
        failures.push(`${step.name}: no pageshow after leaving`);
      }
      continue;
    }
    const observed = server.reports.find(
      (report) => report.kind === 'state' && report.name === step.name,
    );
    if (observed) {
      check(step.name, observed, step.url, step.hidden);
    } else {
      failures.push(`${step.name}: no state reported`);
    }
  }

  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
  console.log('packaged extension behaves correctly on the fixture');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
