const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const contentScript = fs.readFileSync(path.join(projectRoot, 'content.js'), 'utf8');
const styleId = 'hide-google-images-for-you-gallery';

function loadContentScript(pageUrl, options = {}) {
  const styleElements = new Map();
  const eventHandlers = new Map();
  let observerCallback;

  const document = {
    head: options.headAvailable === false ? null : {
      append(styleElement) {
        styleElements.set(styleElement.id, styleElement);
        styleElement.isConnected = true;
      },
    },
    documentElement: options.documentElementAvailable === false ? null : {},
    getElementById(id) {
      const styleElement = styleElements.get(id);
      return styleElement?.isConnected ? styleElement : null;
    },
    createElement(tagName) {
      assert.equal(tagName, 'style');
      return {
        id: '',
        textContent: '',
        isConnected: false,
        remove() {
          this.isConnected = false;
        },
      };
    },
  };

  const window = {
    location: { href: pageUrl },
    addEventListener(eventName, callback) {
      eventHandlers.set(eventName, callback);
    },
  };

  class MockMutationObserver {
    constructor(callback) {
      observerCallback = callback;
    }

    observe(target, options) {
      assert.equal(target, document);
      assert.equal(options.childList, true);
      assert.equal(options.subtree, true);
    }
  }

  vm.runInNewContext(contentScript, {
    document,
    window,
    MutationObserver: MockMutationObserver,
    URL,
    Set,
  });

  return {
    document,
    eventHandlers,
    get observerCallback() {
      return observerCallback;
    },
    styleElements,
    window,
  };
}

function isHidden(page) {
  return page.document.getElementById(styleId) !== null;
}

const landingUrl = 'https://www.google.com/search?udm=49&udf=257';

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
  ['typed image search', 'https://www.google.com/search?q=book+covers&udf=257&udm=2', false],
  ['empty q', `${landingUrl}&q=`, false],
  ['trailing slash pathname', 'https://www.google.com/search/?udm=49&udf=257', false],
  ['other pathname', 'https://www.google.com/images?udm=49&udf=257', false],
];

for (const [name, url, hidden] of routeCases) {
  test(`${hidden ? 'hides' : 'shows'} sections for ${name}`, () => {
    assert.equal(isHidden(loadContentScript(url)), hidden);
  });
}

test('hidden state targets the gallery and pagination sections', () => {
  const page = loadContentScript(landingUrl);
  const style = page.document.getElementById(styleId);

  assert.match(style.textContent, /#center_col #rso/);
  assert.match(style.textContent, /#center_col #botstuff/);
});

test('removes the hiding style when a dynamic route becomes a search', () => {
  const page = loadContentScript('https://www.google.com/search?udm=49&udf=257');
  const style = page.document.getElementById(styleId);

  page.window.location.href =
    'https://www.google.com/search?q=book+covers&udf=257&udm=2';
  page.observerCallback();

  assert.equal(style.isConnected, false);
  assert.equal(page.document.getElementById(styleId), null);
});

test('waits for the document head before injecting styles', () => {
  const page = loadContentScript(
    'https://www.google.com/search?udm=49&udf=257',
    { headAvailable: false, documentElementAvailable: false },
  );

  assert.equal(page.document.getElementById(styleId), null);
  page.document.head = {
    append(styleElement) {
      page.styleElements.set(styleElement.id, styleElement);
      styleElement.isConnected = true;
    },
  };
  page.observerCallback();

  assert.ok(page.document.getElementById(styleId));
});
