export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

interface SectionProgressInput {
  rectTop: number;
  sectionHeight: number;
  viewportHeight: number;
}

export function sectionProgress({ rectTop, sectionHeight, viewportHeight }: SectionProgressInput): number {
  const total = sectionHeight - viewportHeight;
  if (total <= 0) return 0;
  const scrolled = clamp(-rectTop, 0, total);
  return scrolled / total;
}

export interface PatternAFrame {
  cardWidth: number;
  cardHeight: number;
  cardBottom: number;
  cardRadius: number;
  titleY: number;
  titleOpacity: number;
  wordsOpacity: number;
  wordLeftX: number;
  wordRightX: number;
}

export function patternAFrame(progress: number): PatternAFrame {
  const growT = clamp(progress / 0.30, 0, 1);
  const cardWidth = lerp(50, 100, growT);
  const cardHeight = lerp(55, 100, growT);
  const cardBottom = lerp(-8, 0, growT);
  const cardRadius = lerp(24, 0, growT);

  const titleY = -growT * 250;
  const titleOpacity = clamp(1 - growT * 1.4, 0, 1);

  const wordT = clamp((progress - 0.30) / 0.70, 0, 1);
  const wordsOpacity = wordT;
  const wordLeftX = (1 - wordT) * -80;
  const wordRightX = (1 - wordT) * 80;

  return {
    cardWidth, cardHeight, cardBottom, cardRadius,
    titleY, titleOpacity,
    wordsOpacity, wordLeftX, wordRightX,
  };
}
