import { describe, it, expect } from 'vitest';
import {
  getGuardrailText,
  getPromptTemplate,
  renderPrompt,
  PromptType,
} from '@/lib/ai/prompt-templates';

/**
 * Unit tests for lib/ai/prompt-templates.ts
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */

describe('getGuardrailText', () => {
  it('returns the shared SYSTEM_GUARDRAIL text', () => {
    const text = getGuardrailText();
    expect(text).toContain('Mimamori does NOT diagnose');
    expect(text).toContain('objective clinical synthesis');
    expect(text).toContain('Do not extract or infer diagnoses');
  });
});

describe('getPromptTemplate', () => {
  const types: PromptType[] = ['default-analysis', 'visit-prep', 'generate-probes'];

  for (const type of types) {
    it(`returns a non-empty template for "${type}"`, () => {
      const template = getPromptTemplate(type);
      expect(template).toBeTruthy();
      expect(template.length).toBeGreaterThan(0);
    });

    it(`template for "${type}" contains {{logs}} and {{documents}} markers`, () => {
      const template = getPromptTemplate(type);
      expect(template).toContain('{{logs}}');
      expect(template).toContain('{{documents}}');
    });
  }
});

describe('renderPrompt', () => {
  const sampleLogs = [{ date: '2024-01-01', mood: 'good' }];
  const sampleDocs = [{ name: 'blood-test.pdf', type: 'Lab Result' }];

  it('interpolates logs data into the rendered prompt', () => {
    const result = renderPrompt('default-analysis', {
      logs: sampleLogs,
      documents: sampleDocs,
    });
    expect(result).toContain(JSON.stringify(sampleLogs));
  });

  it('interpolates documents data into the rendered prompt', () => {
    const result = renderPrompt('default-analysis', {
      logs: sampleLogs,
      documents: sampleDocs,
    });
    expect(result).toContain(JSON.stringify(sampleDocs));
  });

  it('includes guardrail text in the rendered prompt', () => {
    const result = renderPrompt('default-analysis', {
      logs: sampleLogs,
      documents: sampleDocs,
    });
    expect(result).toContain('Mimamori does NOT diagnose');
  });

  it('does not contain raw {{logs}} or {{documents}} markers after rendering', () => {
    const result = renderPrompt('visit-prep', {
      logs: sampleLogs,
      documents: sampleDocs,
    });
    expect(result).not.toContain('{{logs}}');
    expect(result).not.toContain('{{documents}}');
  });

  it('handles empty logs and documents arrays', () => {
    const result = renderPrompt('generate-probes', {
      logs: [],
      documents: [],
    });
    expect(result).toContain('[]');
    expect(result).toContain('Mimamori does NOT diagnose');
  });
});
