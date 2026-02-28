/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { render } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

// Feature: mimamori-reliability-audit, Property 22: Error boundary preserves application state

/**
 * Property 22: Error boundary preserves application state
 *
 * *For any* rendering error caught by the ErrorBoundary component,
 * localStorage data and authentication cookies should remain unchanged
 * after the error boundary renders its fallback UI.
 *
 * **Validates: Requirements 23.2, 23.4**
 */

/** A component that always throws when rendered, triggering the error boundary. */
function ThrowingComponent({ error }: { error: Error }): never {
  throw error;
}

/** Keys that are problematic for object property access or localStorage. */
const RESERVED_KEYS = new Set([
  '__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty',
  'prototype', '__defineGetter__', '__defineSetter__', '__lookupGetter__',
  '__lookupSetter__', 'toLocaleString', 'isPrototypeOf', 'propertyIsEnumerable',
]);

/** Arbitrary for localStorage key-value pairs (non-empty ASCII keys, no reserved names). */
const localStorageEntryArb = fc.tuple(
  fc.string({ minLength: 1, maxLength: 30 })
    .filter((s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s) && !RESERVED_KEYS.has(s)),
  fc.string({ minLength: 0, maxLength: 200 }),
);

/** Arbitrary for a set of localStorage entries (1–5 pairs with unique keys). */
const localStorageDataArb = fc
  .uniqueArray(localStorageEntryArb, {
    minLength: 1,
    maxLength: 5,
    selector: ([key]) => key,
  });

/** Arbitrary for cookie name-value pairs (simple alphanumeric names and values). */
const cookieEntryArb = fc.tuple(
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
  fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)),
);

/** Arbitrary for a set of cookies (1–3 pairs with unique names). */
const cookieDataArb = fc
  .uniqueArray(cookieEntryArb, {
    minLength: 1,
    maxLength: 3,
    selector: ([name]) => name,
  });

/** Arbitrary for error messages. */
const errorMessageArb = fc.string({ minLength: 1, maxLength: 100 });

/** Suppress console.error during tests since ErrorBoundary logs errors. */
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
  // Clear all cookies
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  });
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  localStorage.clear();
});

describe('Property 22: Error boundary preserves application state', () => {
  it('localStorage data remains unchanged after error boundary catches a rendering error', () => {
    fc.assert(
      fc.property(
        localStorageDataArb,
        errorMessageArb,
        (entries, errorMsg) => {
          // Setup: populate localStorage with random data
          localStorage.clear();
          for (const [key, value] of entries) {
            localStorage.setItem(key, value);
          }

          // Capture the state before the error
          const beforeSnapshot: Record<string, string> = {};
          for (const [key] of entries) {
            beforeSnapshot[key] = localStorage.getItem(key)!;
          }
          const beforeLength = localStorage.length;

          // Act: render ErrorBoundary wrapping a component that throws
          const { unmount } = render(
            React.createElement(
              ErrorBoundary,
              null,
              React.createElement(ThrowingComponent, { error: new Error(errorMsg) }),
            ),
          );

          // Assert: localStorage is unchanged
          expect(localStorage.length).toBe(beforeLength);
          for (const [key, value] of entries) {
            expect(localStorage.getItem(key)).toBe(value);
          }
          // Verify snapshot matches
          for (const [key] of entries) {
            expect(localStorage.getItem(key)).toBe(beforeSnapshot[key]);
          }

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });

  it('authentication cookies remain unchanged after error boundary catches a rendering error', () => {
    fc.assert(
      fc.property(
        cookieDataArb,
        errorMessageArb,
        (cookies, errorMsg) => {
          // Clear cookies first
          document.cookie.split(';').forEach((c) => {
            const name = c.split('=')[0].trim();
            if (name) {
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            }
          });

          // Setup: set random cookies
          for (const [name, value] of cookies) {
            document.cookie = `${name}=${value};path=/`;
          }

          // Capture the cookie string before the error
          const cookiesBefore = document.cookie;

          // Act: render ErrorBoundary wrapping a component that throws
          const { unmount } = render(
            React.createElement(
              ErrorBoundary,
              null,
              React.createElement(ThrowingComponent, { error: new Error(errorMsg) }),
            ),
          );

          // Assert: cookies are unchanged
          expect(document.cookie).toBe(cookiesBefore);

          // Verify each cookie is still present
          for (const [name, value] of cookies) {
            expect(document.cookie).toContain(`${name}=${value}`);
          }

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });

  it('both localStorage and cookies are preserved simultaneously after error boundary renders fallback', () => {
    fc.assert(
      fc.property(
        localStorageDataArb,
        cookieDataArb,
        errorMessageArb,
        (storageEntries, cookies, errorMsg) => {
          // Setup localStorage
          localStorage.clear();
          for (const [key, value] of storageEntries) {
            localStorage.setItem(key, value);
          }
          const storageLengthBefore = localStorage.length;

          // Clear and setup cookies
          document.cookie.split(';').forEach((c) => {
            const name = c.split('=')[0].trim();
            if (name) {
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            }
          });
          for (const [name, value] of cookies) {
            document.cookie = `${name}=${value};path=/`;
          }
          const cookiesBefore = document.cookie;

          // Act: render ErrorBoundary wrapping a component that throws
          const { unmount } = render(
            React.createElement(
              ErrorBoundary,
              null,
              React.createElement(ThrowingComponent, { error: new Error(errorMsg) }),
            ),
          );

          // Assert: localStorage preserved
          expect(localStorage.length).toBe(storageLengthBefore);
          for (const [key, value] of storageEntries) {
            expect(localStorage.getItem(key)).toBe(value);
          }

          // Assert: cookies preserved
          expect(document.cookie).toBe(cookiesBefore);
          for (const [name, value] of cookies) {
            expect(document.cookie).toContain(`${name}=${value}`);
          }

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});
