function enhancePlantPages() {
  const article = document.querySelector(".page-content--plants");
  if (!article) return;

  article.querySelectorAll(":scope > h2").forEach((heading) => {
    let node = heading.nextElementSibling;
    const cards = [];

    while (node?.matches("p") && node.querySelector("img")) {
      const imageParagraph = node;
      const link = imageParagraph.querySelector("img").closest("a");
      const captionParagraph = imageParagraph.nextElementSibling?.matches("p")
        ? imageParagraph.nextElementSibling
        : null;
      const next = captionParagraph
        ? captionParagraph.nextElementSibling
        : imageParagraph.nextElementSibling;
      const card = document.createElement("figure");
      card.className = "plant-card";

      while (imageParagraph.firstChild) {
        card.append(imageParagraph.firstChild);
      }

      if (captionParagraph?.textContent.trim()) {
        const caption = document.createElement("figcaption");
        while (captionParagraph.firstChild) {
          caption.append(captionParagraph.firstChild);
        }
        card.append(caption);
      }

      imageParagraph.remove();
      captionParagraph?.remove();
      if (link) {
        link.replaceWith(...link.childNodes);
        link.append(card);
        cards.push(link);
      } else {
        cards.push(card);
      }
      node = next;
    }

    if (cards.length) {
      const grid = document.createElement("div");
      grid.className = "plant-grid";
      heading.after(grid);
      cards.forEach((card) => grid.append(card));
    }
  });
}

function enhanceDirectorPage() {
  const article = document.querySelector(".page-content--team");
  const firstHeading = article?.querySelector(":scope > h2");
  if (!article || !firstHeading) return;

  const grid = document.createElement("div");
  grid.className = "director-grid";
  firstHeading.before(grid);
  let node = firstHeading;
  let card;

  while (node) {
    const next = node.nextElementSibling;
    if (node.matches("h2")) {
      card = document.createElement("section");
      card.className = "director-card";
      grid.append(card);
      card.append(node);
    } else if (node.matches("hr")) {
      node.remove();
    } else if (card) {
      card.append(node);
    }
    node = next;
  }
}

function initializeGallery() {
  const list = document.querySelector("#album-list");
  if (!list) return;

  const albums = [...list.querySelectorAll(".album-card")];
  const filter = document.querySelector("#gallery-year");
  const status = document.querySelector("#gallery-status");
  const dialog = document.querySelector("#photo-viewer");
  const image = dialog?.querySelector(".viewer-image");
  const caption = dialog?.querySelector(".viewer-caption");
  const closeButton = dialog?.querySelector(".viewer-close");
  const previousButton = dialog?.querySelector(".viewer-prev");
  const nextButton = dialog?.querySelector(".viewer-next");
  let currentPhotos = [];
  let currentIndex = 0;

  filter?.addEventListener("change", () => {
    const year = filter.value;
    let visibleCount = 0;
    albums.forEach((album) => {
      const visible = year === "all" || album.dataset.year === year;
      album.hidden = !visible;
      if (visible) visibleCount++;
    });
    status.textContent = `${visibleCount} photo ${visibleCount === 1 ? "album" : "albums"}`;
  });

  function showPhoto(index) {
    currentIndex = index;
    const photo = currentPhotos[currentIndex];
    image.width = Number(photo.dataset.width);
    image.height = Number(photo.dataset.height);
    image.src = photo.dataset.fullSrc;
    image.alt = photo.dataset.alt || "";
    caption.textContent = photo.dataset.caption || photo.dataset.alt || "";
    previousButton.disabled = currentIndex === 0;
    nextButton.disabled = currentIndex === currentPhotos.length - 1;
  }

  list.addEventListener("click", (event) => {
    const button = event.target.closest(".photo-button");
    if (!button || !dialog || !image || !caption) return;

    currentPhotos = [...button.closest(".album-card").querySelectorAll(".photo-button")];
    showPhoto(currentPhotos.indexOf(button));
    dialog.showModal();
  });

  closeButton?.addEventListener("click", () => dialog.close());
  previousButton?.addEventListener("click", () => {
    if (currentIndex > 0) showPhoto(currentIndex - 1);
  });
  nextButton?.addEventListener("click", () => {
    if (currentIndex < currentPhotos.length - 1) showPhoto(currentIndex + 1);
  });

  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" && currentIndex > 0) showPhoto(currentIndex - 1);
    if (event.key === "ArrowRight" && currentIndex < currentPhotos.length - 1) showPhoto(currentIndex + 1);
  });
}

function openExternalLinksInNewTabs() {
  document.querySelectorAll("a[href]").forEach((link) => {
    if (
      (link.protocol === "http:" || link.protocol === "https:") &&
      link.origin !== window.location.origin
    ) {
      link.target = "_blank";
      link.relList.add("noopener");
    }
  });
}

enhancePlantPages();
enhanceDirectorPage();
initializeGallery();
openExternalLinksInNewTabs();
