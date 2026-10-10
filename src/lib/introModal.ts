export const OPEN_INTRO_EVENT = "od:open-intro";

export function openIntroModal(): void {
  window.dispatchEvent(new Event(OPEN_INTRO_EVENT));
}

export const CONTACT_EMAIL = "contact@opendefence.fi";
