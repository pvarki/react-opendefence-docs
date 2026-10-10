/**
 * Optional brand marks (logos) for cards, served from public/images/.
 * Keys: home-card targets and collection slugs.
 */
export interface CardImage {
  src: string;
  logo?: boolean;
}

export const CARD_IMAGES: Record<string, CardImage> = {
  "guides/mtx-guide": { src: "/images/mtxlogo.svg", logo: true },
  "guides/matrix-guide": { src: "/images/matrixlogo.svg", logo: true },
  "guides/cryptpad-guide": { src: "/images/cryptpadlogo.svg", logo: true },
  "wikis/mtx": { src: "/images/mtxlogo.svg", logo: true },
};
