const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const contentScript = fs.readFileSync(path.join(projectRoot, 'content.js'), 'utf8');
const contentCss = fs.readFileSync(path.join(projectRoot, 'content.css'), 'utf8');
const manifest = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'manifest.json'), 'utf8'),
);
const hideAttribute = 'data-hide-images-for-you';

// Runs content.js against minimal browser stand-ins. The script may only
// touch the root attribute and register listeners: any other DOM access, or
// use of MutationObserver, throws.
function loadContentScript(pageUrl) {
  const attributes = new Set();
  const windowHandlers = new Map();
  const navigationHandlers = new Map();
  const counters = { attributeWrites: 0 };

  const document = {
    documentElement: {
      toggleAttribute(name, force) {
        counters.attributeWrites += 1;
        if (force) {
          attributes.add(name);
        } else {
          attributes.delete(name);
        }
        return force;
      },
      hasAttribute: (name) => attributes.has(name),
    },
  };

  const window = {
    location: { href: pageUrl },
    addEventListener(eventName, callback) {
      windowHandlers.set(eventName, callback);
    },
    navigation: {
      addEventListener(eventName, callback) {
        navigationHandlers.set(eventName, callback);
      },
    },
  };

  vm.runInNewContext(contentScript, { document, window, URL });

  return {
    counters,
    // Moves the page to `url` the way a same-document navigation does.
    navigate(url) {
      window.location.href = url;
      navigationHandlers.get('currententrychange')();
    },
    isHidden: () => document.documentElement.hasAttribute(hideAttribute),
    navigationHandlers,
    window,
    windowHandlers,
  };
}

const landingUrl = 'https://www.google.com/search?udm=49&udf=257';
const typedUrl = 'https://www.google.com/search?q=book+covers&udf=257&udm=2';

const routeCases = [
  ['landing route', landingUrl, true],
  ['pagination without q', `${landingUrl}&start=10`, true],
  ['reordered parameters', 'https://www.google.com/search?udf=257&udm=49', true],
  ['unrelated parameter', `${landingUrl}&hl=en`, true],
  ['missing udm', 'https://www.google.com/search?udf=257', false],
  ['incorrect udm', 'https://www.google.com/search?udm=2&udf=257', false],
  ['missing udf', 'https://www.google.com/search?udm=49', false],
  ['incorrect udf', 'https://www.google.com/search?udm=49&udf=258', false],
  ['populated q', `${landingUrl}&q=book+covers`, false],
  ['typed image search', typedUrl, false],
  ['empty q', `${landingUrl}&q=`, false],
  ['trailing slash pathname', 'https://www.google.com/search/?udm=49&udf=257', false],
  ['other pathname', 'https://www.google.com/images?udm=49&udf=257', false],
];

for (const [name, url, hidden] of routeCases) {
  test(`${hidden ? 'hides' : 'shows'} sections for ${name}`, () => {
    assert.equal(loadContentScript(url).isHidden(), hidden);
  });
}

test('listens for navigation entry changes and page restoration only', () => {
  const page = loadContentScript(landingUrl);

  assert.deepEqual([...page.navigationHandlers.keys()], ['currententrychange']);
  assert.deepEqual([...page.windowHandlers.keys()], ['pageshow']);
});

test('shows sections when a same-document navigation adds a query', () => {
  const page = loadContentScript(landingUrl);

  page.navigate(typedUrl);

  assert.equal(page.isHidden(), false);
});

test('hides sections when a same-document navigation returns to the landing route', () => {
  const page = loadContentScript(typedUrl);
  assert.equal(page.isHidden(), false);

  page.navigate(landingUrl);

  assert.equal(page.isHidden(), true);
});

test('recomputes visibility when a page is restored', () => {
  const page = loadContentScript(landingUrl);

  page.window.location.href = typedUrl;
  page.windowHandlers.get('pageshow')();
  assert.equal(page.isHidden(), false);

  page.window.location.href = landingUrl;
  page.windowHandlers.get('pageshow')();
  assert.equal(page.isHidden(), true);
});

test('keeps the correct state across repeated updates', () => {
  const page = loadContentScript(landingUrl);

  for (let index = 0; index < 3; index += 1) {
    page.navigate(typedUrl);
    assert.equal(page.isHidden(), false);
    page.navigate(landingUrl);
    assert.equal(page.isHidden(), true);
    page.navigate(landingUrl);
    assert.equal(page.isHidden(), true);
  }
});

test('stylesheet hides only the gallery and pagination under the root attribute', () => {
  const rules = contentCss.match(/[^{}]+\{[^{}]*\}/g);

  assert.equal(rules.length, 1);
  const [selectorList, declarations] = rules[0].split('{');
  assert.deepEqual(
    selectorList.split(',').map((selector) => selector.trim()),
    [
      `html[${hideAttribute}] #center_col #rso`,
      `html[${hideAttribute}] #center_col #botstuff`,
    ],
  );
  assert.equal(declarations.replace(/\s+/g, ' ').trim(), 'display: none !important; }');
});

test('manifest declares the supported hosts, stylesheet, and script', () => {
  const [entry, ...others] = manifest.content_scripts;

  assert.equal(others.length, 0);
  assert.deepEqual(entry.matches, [
    'https://www.google.com/search*',
    'https://google.com/search*',
    'https://images.google.com/search*',
  ]);
  assert.deepEqual(entry.css, ['content.css']);
  assert.deepEqual(entry.js, ['content.js']);
  assert.equal(entry.run_at, 'document_start');
  assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, '147.0');
  assert.equal(manifest.permissions, undefined);
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(
    manifest.browser_specific_settings.gecko.data_collection_permissions,
    { required: ['none'] },
  );
});
