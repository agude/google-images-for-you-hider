(() => {
  const hideAttribute = "data-hide-images-for-you";

  function isForYouLandingPage() {
    const pageUrl = new URL(window.location.href);

    return (
      pageUrl.pathname === "/search" &&
      pageUrl.searchParams.get("udm") === "49" &&
      pageUrl.searchParams.get("udf") === "257" &&
      !pageUrl.searchParams.has("q")
    );
  }

  function updateGalleryVisibility() {
    document.documentElement.toggleAttribute(
      hideAttribute,
      isForYouLandingPage(),
    );
  }

  updateGalleryVisibility();

  window.navigation.addEventListener("currententrychange", updateGalleryVisibility);
  window.addEventListener("pageshow", updateGalleryVisibility);
})();
