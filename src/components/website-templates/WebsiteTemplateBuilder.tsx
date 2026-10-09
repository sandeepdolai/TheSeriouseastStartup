"use client";

import { WebsiteEditor } from "./WebsiteEditor";

/** Backwards-compatible entry point, now using the lightweight image/text editor. */
export function WebsiteTemplateBuilder({ onClose }: { onClose?: () => void } = {}) {
  const close = () => {
    if (onClose) {
      onClose();
      return;
    }
    window.location.assign("/");
  };

  return <WebsiteEditor templateSlug="love-of-my-life" onClose={close} />;
}
