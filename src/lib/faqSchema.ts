// FAQPage structured data (JSON-LD), built from the same text the page shows, so the two can never drift apart.

export type FaqItem = { readonly q: string; readonly a: string }

export function faqJsonLd(items: readonly FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  }
}

/** Safe to place inside a script tag: a less-than sign can never close it early. */
export const faqJsonLdText = (items: readonly FaqItem[]) => JSON.stringify(faqJsonLd(items)).replace(/</g, '\u003c')
