'use strict';

// Verifies that a content script running at document_start receives
// `currententrychange` for pushState, replaceState, and history traversal,
// with no DOM mutation, and sees the new URL when its handler runs.
//
// Usage: node tests/browser/navigation-probe.js
// Set FIREFOX_BINARY to test a specific Firefox build.

const path = require('node:path');
const { firefoxVersion, launchFirefox, startServer } = require('./harness');

const landing = '/search?udm=49&udf=257';
const typed = '/search?udm=49&udf=257&q=book+covers';
const emptyQuery = '/search?udm=49&udf=257&q=';

// Each step runs in the page context, as a site's own scripts would.
const steps = [
  { name: 'push: hidden -> visible (q)', code: `history.pushState({}, '', '${typed}')`, url: typed, type: 'push' },
  { name: 'replace: visible -> hidden', code: `history.replaceState({}, '', '${landing}')`, url: landing, type: 'replace' },
  { name: 'replace: hidden -> visible (empty q)', code: `history.replaceState({}, '', '${emptyQuery}')`, url: emptyQuery, type: 'replace' },
  { name: 'push: visible -> hidden', code: `history.pushState({}, '', '${landing}')`, url: landing, type: 'push' },
  { name: 'traverse back', code: 'history.back()', url: emptyQuery, type: 'traverse' },
  { name: 'traverse forward', code: 'history.forward()', url: landing, type: 'traverse' },
];

const pageScript = `
const steps = ${JSON.stringify(steps)};
const report = (data) => fetch('/__report?' + new URLSearchParams({ data: JSON.stringify(data) }));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  await sleep(1000);
  for (const step of steps) {
    await report({ kind: 'step', name: step.name });
    new Function(step.code)();
    await sleep(500);
  }
  await report({ kind: 'done' });
})();
`;

async function main() {
  const server = await startServer(pageScript);
  const stop = launchFirefox(
    path.join(__dirname, 'probe'),
    server.origin + landing,
  );
  const failures = [];

  try {
    await server.waitForReport((report) => report.kind === 'done', 60000);
  } catch (error) {
    failures.push(`sequence did not finish: ${error.message}`);
  } finally {
    stop();
    server.close();
  }

  console.log(firefoxVersion());
  const initial = server.reports.find((report) => report.type === 'initial');
  console.log(`window.navigation in the content script: ${initial?.navigationApi}`);
  if (initial?.navigationApi !== 'object') {
    failures.push('window.navigation is not available to the content script');
  }

  steps.forEach((step, index) => {
    const start = server.reports.findIndex((report) => report.name === step.name);
    const end = server.reports.findIndex(
      (report, position) => position > start && report.kind !== 'probe',
    );
    const events = server.reports
      .slice(start + 1, end === -1 ? undefined : end)
      .filter((report) => report.type === 'currententrychange');
    const seen = events.map((event) => {
      const url = new URL(event.url);
      return `${event.navigationType} ${url.pathname}${url.search}`;
    });
    const expected = `${step.type} ${step.url}`;
    const ok = seen.length === 1 && seen[0] === expected;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${step.name}: ${seen.join(', ') || 'no event'}`);
    if (!ok) {
      failures.push(`${step.name}: expected one "${expected}", saw [${seen.join(', ')}]`);
    }
  });

  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
  console.log('all navigation events delivered');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
