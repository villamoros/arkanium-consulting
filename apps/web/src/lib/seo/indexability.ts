/** Central policy used by page generation and discovery. Absence from a sitemap is never the only protection. */
export interface IndexabilityInput {
  noIndex?: boolean;
  visibility?: 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
  published?: boolean;
  archived?: boolean;
}

export function isIndexable(input: IndexabilityInput = {}): boolean {
  return input.noIndex !== true
    && input.visibility !== 'UNLISTED'
    && input.visibility !== 'PRIVATE'
    && input.published !== false
    && input.archived !== true;
}
