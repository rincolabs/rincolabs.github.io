const initLazyLoadImages = (selector = "img[data-src], img[loading='lazy']") => {
  const images = Array.from(document.querySelectorAll(selector));

  if (images.length === 0) {
    return;
  }

  const loadImage = (image) => {
    const { src, srcset } = image.dataset;

    if (srcset) {
      image.srcset = srcset;
      delete image.dataset.srcset;
    }

    if (src) {
      image.src = src;
      delete image.dataset.src;
    }

    image.classList.add("is-loaded");
  };

  const nativeLazySupported = "loading" in HTMLImageElement.prototype;
  const observerSupported = "IntersectionObserver" in window;

  if (nativeLazySupported || !observerSupported) {
    images.forEach((image) => {
      if (!image.loading) {
        image.loading = "lazy";
      }

      loadImage(image);
    });

    return;
  }

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        loadImage(entry.target);
        currentObserver.unobserve(entry.target);
      });
    },
    { rootMargin: "200px 0px" },
  );

  images.forEach((image) => observer.observe(image));
};

initLazyLoadImages();

const headers = document.querySelectorAll(".site-header");

headers.forEach((header) => {
  const toggle = header.querySelector(".menu-toggle");
  const nav = header.querySelector(".site-nav");

  if (!toggle || !nav) {
    return;
  }

  const closeMenu = () => {
    nav.classList.remove("is-open");
    toggle.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation menu");
  };

  const openMenu = () => {
    nav.classList.add("is-open");
    toggle.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close navigation menu");
  };

  toggle.addEventListener("click", () => {
    if (nav.classList.contains("is-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("click", (event) => {
    if (!header.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
});

const normalizePlatform = () => {
  const platform =
    navigator.userAgentData?.platform ||
    navigator.platform ||
    navigator.userAgent ||
    "";
  const userAgent = navigator.userAgent || "";
  const value = `${platform} ${userAgent}`.toLowerCase();

  if (value.includes("win")) {
    return "windows";
  }

  if (value.includes("mac")) {
    return "macos";
  }

  if (value.includes("linux") || value.includes("x11")) {
    return "linux";
  }

  return "linux";
};

const detectedPlatform = normalizePlatform();
const selectedPlatform = detectedPlatform === "macos" ? "linux" : detectedPlatform;

document.querySelectorAll("[data-platform]").forEach((card) => {
  card.classList.toggle("platform-card-primary", card.dataset.platform === selectedPlatform);
  card.classList.toggle("is-detected", card.dataset.platform === selectedPlatform);
});

document.querySelectorAll(".js-os-download-button").forEach((button) => {
  const platform = detectedPlatform === "macos" ? "macos" : selectedPlatform;
  const label = button.dataset[`${platform}Label`];
  const href = button.dataset[`${platform}Href`];

  if (label) {
    const icon = button.querySelector("[aria-hidden='true']");
    button.textContent = "";

    if (icon) {
      button.append(icon, " ");
    }

    button.append(label);
  }

  if (href) {
    button.setAttribute("href", href);
  }
});

let activePreviewGroup = [];
let activePreviewIndex = 0;

const createMediaPreview = () => {
  const dialog = document.createElement("div");
  dialog.className = "media-preview";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Image preview");
  dialog.setAttribute("aria-hidden", "true");

  const backdrop = document.createElement("button");
  backdrop.className = "media-preview-backdrop";
  backdrop.type = "button";
  backdrop.setAttribute("aria-label", "Close image preview");

  const stage = document.createElement("div");
  stage.className = "media-preview-stage";

  const closeButton = document.createElement("button");
  closeButton.className = "media-preview-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close image preview");
  closeButton.textContent = "Close";

  const previousButton = document.createElement("button");
  previousButton.className = "media-preview-button media-preview-button-prev";
  previousButton.type = "button";
  previousButton.setAttribute("aria-label", "Previous image");
  previousButton.textContent = "<";

  const image = document.createElement("img");
  image.className = "media-preview-image";
  image.alt = "";

  const nextButton = document.createElement("button");
  nextButton.className = "media-preview-button media-preview-button-next";
  nextButton.type = "button";
  nextButton.setAttribute("aria-label", "Next image");
  nextButton.textContent = ">";

  const dots = document.createElement("div");
  dots.className = "media-preview-dots";
  dots.setAttribute("aria-label", "Preview images");

  stage.append(closeButton, previousButton, image, nextButton, dots);
  dialog.append(backdrop, stage);
  document.body.append(dialog);

  return {
    closeButton,
    dialog,
    dots,
    image,
    nextButton,
    previousButton,
  };
};

let mediaPreview = null;

const closeMediaPreview = () => {
  if (!mediaPreview || !mediaPreview.dialog.classList.contains("is-open")) {
    return;
  }

  mediaPreview.dialog.classList.remove("is-open");
  mediaPreview.dialog.setAttribute("aria-hidden", "true");
  document.body.classList.remove("media-preview-open");
};

const renderMediaPreview = () => {
  if (!mediaPreview || activePreviewGroup.length === 0) {
    return;
  }

  activePreviewIndex =
    (activePreviewIndex + activePreviewGroup.length) % activePreviewGroup.length;
  const currentItem = activePreviewGroup[activePreviewIndex];
  mediaPreview.image.src = currentItem.src;
  mediaPreview.image.alt = currentItem.alt || "Image preview";

  const hasMultipleItems = activePreviewGroup.length > 1;
  mediaPreview.previousButton.hidden = !hasMultipleItems;
  mediaPreview.nextButton.hidden = !hasMultipleItems;
  mediaPreview.dots.hidden = !hasMultipleItems;
  mediaPreview.dots.replaceChildren(
    ...activePreviewGroup.map((item, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = index === activePreviewIndex ? "is-active" : "";
      dot.setAttribute("aria-label", item.alt || `Show image ${index + 1}`);
      dot.setAttribute("aria-current", index === activePreviewIndex ? "true" : "false");
      dot.addEventListener("click", () => {
        activePreviewIndex = index;
        renderMediaPreview();
        item.showSlide?.(index);
      });
      return dot;
    }),
  );

  currentItem.showSlide?.(activePreviewIndex);
};

const showMediaPreview = (group, index) => {
  if (!mediaPreview) {
    mediaPreview = createMediaPreview();
    mediaPreview.closeButton.addEventListener("click", closeMediaPreview);
    mediaPreview.dialog
      .querySelector(".media-preview-backdrop")
      ?.addEventListener("click", closeMediaPreview);
    mediaPreview.previousButton.addEventListener("click", () => {
      activePreviewIndex -= 1;
      renderMediaPreview();
    });
    mediaPreview.nextButton.addEventListener("click", () => {
      activePreviewIndex += 1;
      renderMediaPreview();
    });
  }

  activePreviewGroup = group;
  activePreviewIndex = index;
  renderMediaPreview();
  document.body.classList.add("media-preview-open");
  mediaPreview.dialog.classList.add("is-open");
  mediaPreview.dialog.setAttribute("aria-hidden", "false");
  mediaPreview.closeButton.focus();
};

document.querySelectorAll("[data-carousel]").forEach((carousel) => {
  const track = carousel.querySelector(".media-carousel-track");
  const slides = carousel.querySelectorAll(".media-carousel-slide");
  const previousButton = carousel.querySelector("[data-carousel-prev]");
  const nextButton = carousel.querySelector("[data-carousel-next]");
  const dots = carousel.querySelectorAll("[data-carousel-dot]");
  let currentIndex = 0;

  if (!track || slides.length === 0) {
    return;
  }

  const showSlide = (index) => {
    currentIndex = (index + slides.length) % slides.length;
    track.style.setProperty("--carousel-index", currentIndex);

    dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === currentIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-current", isActive ? "true" : "false");
    });
  };

  previousButton?.addEventListener("click", () => {
    showSlide(currentIndex - 1);
  });

  nextButton?.addEventListener("click", () => {
    showSlide(currentIndex + 1);
  });

  dots.forEach((dot, dotIndex) => {
    dot.addEventListener("click", () => {
      showSlide(dotIndex);
    });
  });

  const carouselPreviewItems = Array.from(slides)
    .map((slide, slideIndex) => {
      const image = slide.querySelector("img");

      if (!image) {
        return null;
      }

      image.classList.add("media-preview-trigger");
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `Open image preview: ${image.alt}`);

      const item = {
        alt: image.alt,
        showSlide,
        src: image.currentSrc || image.src,
      };

      image.addEventListener("click", () => {
        showMediaPreview(carouselPreviewItems, slideIndex);
      });

      image.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          showMediaPreview(carouselPreviewItems, slideIndex);
        }
      });

      return item;
    })
    .filter(Boolean);

  showSlide(0);
});

document.querySelectorAll(".product-image-hero img, .wide-media-row img").forEach((image) => {
  image.classList.add("media-preview-trigger");
  image.tabIndex = 0;
  image.setAttribute("role", "button");
  image.setAttribute("aria-label", `Open image preview: ${image.alt}`);

  const imagePreviewItem = {
    alt: image.alt,
    src: image.currentSrc || image.src,
  };

  image.addEventListener("click", () => {
    showMediaPreview([imagePreviewItem], 0);
  });

  image.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showMediaPreview([imagePreviewItem], 0);
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (!mediaPreview || !mediaPreview.dialog.classList.contains("is-open")) {
    return;
  }

  if (event.key === "Escape") {
    closeMediaPreview();
  } else if (event.key === "ArrowLeft" && activePreviewGroup.length > 1) {
    activePreviewIndex -= 1;
    renderMediaPreview();
  } else if (event.key === "ArrowRight" && activePreviewGroup.length > 1) {
    activePreviewIndex += 1;
    renderMediaPreview();
  }
});
