/**
 * Optional background images for section/book cards, served from
 * public/images/. Add a file there and map it here — cards without an
 * entry render plain. `logo: true` renders contained on the right at low
 * opacity (for brand marks) instead of as a full-bleed photo backdrop.
 * Keys: home-card targets and collection slugs.
 */
export interface CardImage {
  src: string;
  logo?: boolean;
}

export const CARD_IMAGES: Record<string, CardImage> = {
  "deploy-app": { src: "/images/deployapp.png" },
  guides: { src: "/images/tak.png" },
  advanced: { src: "/images/poweruser.jpg" },
  "guides/tak-guide": { src: "/images/tak.png" },
  "guides/mtx-guide": { src: "/images/mtxlogo.svg", logo: true },
  "guides/matrix-guide": { src: "/images/matrixlogo.svg", logo: true },
  "wikis/tak": { src: "/images/tak.png" },
  "wikis/mtx": { src: "/images/mtxlogo.svg", logo: true },
};

/**
 * Book covers that get a full-width hero banner like the shelf pages, keyed
 * by collection slug. The Deploy App cover reuses its footer photo, framed
 * from the top. Covers without an entry render their plain title heading.
 */
export const COVER_HEROES: Record<string, { src: string; position?: string }> =
  {
    "deploy-app": { src: "/images/deployapp.png", position: "object-top" },
  };
