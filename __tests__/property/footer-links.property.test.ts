import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { landingPageContent } from '@/content/landing-page';
import type { FooterLink } from '@/content/types';

// Feature: mimamori-production-readiness, Property 1: Footer legal links have valid hrefs

/**
 * Property 1: Footer legal links have valid hrefs
 *
 * *For any* link in the footer's Legal section, the `href` value must not be
 * `"#"` and must start with `"/"`.
 *
 * **Validates: Requirements 1.4**
 */

// --- Helpers ---

const legalSection = landingPageContent.footer.sections.find(
  (s) => s.title === 'Legal',
);

/** Generates a valid legal-style link with an href starting with "/" and not "#". */
const validLegalLinkArb: fc.Arbitrary<FooterLink> = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')), {
      minLength: 1,
      maxLength: 30,
    }).map((chars) => chars.join('')),
  )
  .map(([label, pathSegment]) => ({
    label,
    href: `/${pathSegment}`,
  }));

describe('Property 1: Footer legal links have valid hrefs', () => {
  it('all actual Legal section links have hrefs that are not "#" and start with "/"', () => {
    expect(legalSection).toBeDefined();

    fc.assert(
      fc.property(
        fc.constantFrom(...legalSection!.links),
        (link: FooterLink) => {
          expect(link.href).not.toBe('#');
          expect(link.href.startsWith('/')).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('property holds for any set of legal links with valid hrefs', () => {
    fc.assert(
      fc.property(
        fc.array(validLegalLinkArb, { minLength: 1, maxLength: 10 }),
        (links: FooterLink[]) => {
          for (const link of links) {
            expect(link.href).not.toBe('#');
            expect(link.href.startsWith('/')).toBe(true);
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('no Legal section link has a placeholder "#" href', () => {
    expect(legalSection).toBeDefined();

    fc.assert(
      fc.property(
        fc.constantFrom(...legalSection!.links),
        (link: FooterLink) => {
          return link.href !== '#';
        },
      ),
      { numRuns: 20 },
    );
  });
});
