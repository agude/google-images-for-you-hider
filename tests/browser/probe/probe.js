// Reports what an isolated-world content script observes to the fixture
// server, so the test needs no DOM mutation or driver to read the result.
function report(data) {
  fetch('/__report?' + new URLSearchParams({ data: JSON.stringify(data) }));
}

report({
  kind: 'probe',
  type: 'initial',
  url: window.location.href,
  navigationApi: typeof window.navigation,
});

window.navigation?.addEventListener('currententrychange', (event) => {
  report({
    kind: 'probe',
    type: 'currententrychange',
    navigationType: event.navigationType,
    url: window.location.href,
  });
});
