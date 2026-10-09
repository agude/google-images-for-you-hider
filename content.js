(() => {
  const styleElementId = "hide-google-images-for-you-gallery";
  const supportedHosts = new Set([
    "www.google.com",
    "google.com",
    "images.google.com",
  ]);
  const hiddenSectionsRule = `
    #center_col #rso,
    #center_col #botstuff {
      display: none !important;
    }
  `;

  function isForYouLandingPage() {
    const pageUrl = new URL(window.location.href);

    return (
      supportedHosts.has(pageUrl.hostname) &&
      pageUrl.pathname === "/search" &&
      pageUrl.searchParams.get("udm") === "49" &&
      pageUrl.searchParams.get("udf") === "257" &&
      !pageUrl.searchParams.has("q")
    );
  }

  function updateGalleryVisibility() {
    const existingStyle = document.getElementById(styleElementId);

    if (!isForYouLandingPage()) {
      existingStyle?.remove();
      return;
    }

    if (existingStyle) {
      return;
    }

    const styleElement = document.createElement("style");
    styleElement.id = styleElementId;
    styleElement.textContent = hiddenSectionsRule;

    const styleParent = document.head || document.documentElement;
    styleParent?.append(styleElement);
  }

  updateGalleryVisibility();

  const pageObserver = new MutationObserver(updateGalleryVisibility);
  pageObserver.observe(document, {
    childList: true,
    subtree: true,
  });

  window.addEventListener("popstate", updateGalleryVisibility);
  window.addEventListener("pageshow", updateGalleryVisibility);
})();
