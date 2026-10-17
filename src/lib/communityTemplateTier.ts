const PRO_TEMPLATE_MARKER = "[[PAPER_STISH_PRO]]::";

/** Store the Pro flag in the existing description column to avoid a database migration. */
export function encodeCommunityTemplateDescription(description: string, isPro: boolean): string {
  return isPro ? PRO_TEMPLATE_MARKER + description : description;
}

/** Remove the internal marker before any description is shown in the UI. */
export function decodeCommunityTemplateDescription(storedDescription: string | null | undefined): {
  description: string;
  isPro: boolean;
} {
  if (!storedDescription) return { description: "", isPro: false };
  if (!storedDescription.startsWith(PRO_TEMPLATE_MARKER)) {
    return { description: storedDescription, isPro: false };
  }
  return {
    description: storedDescription.slice(PRO_TEMPLATE_MARKER.length),
    isPro: true,
  };
}
