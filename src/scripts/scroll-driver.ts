import { patternAFrame, sectionProgress, clamp } from "../lib/scroll-math";

function updatePatternASection(section: HTMLElement) {
  const rect = section.getBoundingClientRect();
  const vh = window.innerHeight;
  const progress = sectionProgress({
    rectTop: rect.top,
    sectionHeight: section.offsetHeight,
    viewportHeight: vh,
  });
  const f = patternAFrame(progress);
  const card = section.querySelector<HTMLElement>("[data-card]");
  const title = section.querySelector<HTMLElement>("[data-title]");
  const wL = section.querySelector<HTMLElement>("[data-word-left]");
  const wR = section.querySelector<HTMLElement>("[data-word-right]");
  if (card) {
    card.style.width = f.cardWidth + "vw";
    card.style.height = f.cardHeight + "vh";
    card.style.bottom = f.cardBottom + "%";
    card.style.borderRadius = f.cardRadius + "px";
  }
  if (title) {
    title.style.transform = `translate(-50%, calc(-50% + ${f.titleY}px))`;
    title.style.opacity = String(f.titleOpacity);
  }
  if (wL) {
    wL.style.opacity = String(f.wordsOpacity);
    wL.style.transform = `translateX(${f.wordLeftX}px)`;
  }
  if (wR) {
    wR.style.opacity = String(f.wordsOpacity);
    wR.style.transform = `translateX(${f.wordRightX}px)`;
  }

  // Card-internal titles that enter while the card expands.
  // - top title: slides in from the left, ending at its rest position
  // - bottom title: slides in from the right, ending at its rest position
  // Tied to growT but accelerated (×2.2) so the titles arrive while the card
  // is still ~half-grown rather than at full expansion — feels more energetic.
  const titlesT = Math.min(f.growT * 2.2, 1);
  const titleTL = section.querySelector<HTMLElement>("[data-hedge-tl]");
  const titleBR = section.querySelector<HTMLElement>("[data-hedge-br]");
  if (titleTL) {
    const tlOffset = -(1 - titlesT) * 60;
    titleTL.style.transform = `translateX(${tlOffset}vw)`;
    titleTL.style.opacity = String(titlesT);
  }
  if (titleBR) {
    const brOffset = (1 - titlesT) * 60;
    titleBR.style.transform = `translateX(${brOffset}vw)`;
    titleBR.style.opacity = String(titlesT);
  }
}

function updateFlowSection(section: HTMLElement) {
  const rect = section.getBoundingClientRect();
  const vh = window.innerHeight;
  const progress = sectionProgress({
    rectTop: rect.top,
    sectionHeight: section.offsetHeight,
    viewportHeight: vh,
  });
  const titles = section.querySelectorAll<HTMLElement>("[data-flow-title]");
  const descs = section.querySelectorAll<HTMLElement>("[data-flow-desc]");
  const slides = section.querySelectorAll<HTMLElement>("[data-flow-slide]");
  const N = titles.length;
  if (N === 0) return;
  const step = clamp(Math.floor(progress * N), 0, N - 1);

  titles.forEach((t, i) => {
    t.dataset.active = i === step ? "true" : "false";
  });
  descs.forEach((d, i) => {
    d.style.display = i === step ? "block" : "none";
  });
  slides.forEach((s, i) => {
    s.dataset.position = i === step ? "active" : i < step ? "prev" : "next";
  });
}

function update() {
  document.querySelectorAll<HTMLElement>("[data-pattern-a]").forEach(updatePatternASection);
  document.querySelectorAll<HTMLElement>("[data-flow]").forEach(updateFlowSection);
}

let ticking = false;
document.addEventListener("scroll", () => {
  if (!ticking) {
    requestAnimationFrame(() => { update(); ticking = false; });
    ticking = true;
  }
}, { passive: true });
window.addEventListener("resize", update);
update();
