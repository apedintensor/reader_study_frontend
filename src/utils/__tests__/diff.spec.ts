import { describe, it, expect } from 'vitest';
import { computeWasUpdated, buildComparableSubset } from '../diff';

describe('computeWasUpdated', () => {
  const basePre = buildComparableSubset({
    diagnostic_confidence: 3,
    management_confidence: 4,
  investigation_plan: 'biopsy',
  next_step: 'refer',
    diagnoses: [
      { rank: 1, diagnosis_id: 11 },
      { rank: 2, diagnosis_id: 22 },
    ],
  });

  it('returns false when identical', () => {
    const post = buildComparableSubset({
      diagnostic_confidence: 3,
      management_confidence: 4,
  investigation_plan: 'biopsy',
  next_step: 'refer',
      diagnoses: [
        { rank: 1, diagnosis_id: 11 },
        { rank: 2, diagnosis_id: 22 },
      ],
    });
    expect(computeWasUpdated(basePre, post)).toBe(false);
  });

  it('detects confidence change', () => {
    const post = buildComparableSubset({
      diagnostic_confidence: 4,
      management_confidence: 4,
  investigation_plan: 'biopsy',
  next_step: 'refer',
      diagnoses: [
        { rank: 1, diagnosis_id: 11 },
        { rank: 2, diagnosis_id: 22 },
      ],
    });
    expect(computeWasUpdated(basePre, post)).toBe(true);
  });

  it('detects diagnosis id change', () => {
    const post = buildComparableSubset({
      diagnostic_confidence: 3,
      management_confidence: 4,
  investigation_plan: 'biopsy',
  next_step: 'refer',
      diagnoses: [
        { rank: 1, diagnosis_id: 99 },
        { rank: 2, diagnosis_id: 22 },
      ],
    });
    expect(computeWasUpdated(basePre, post)).toBe(true);
  });

  it('detects removed diagnosis', () => {
    const post = buildComparableSubset({
      diagnostic_confidence: 3,
      management_confidence: 4,
  investigation_plan: 'biopsy',
  next_step: 'refer',
      diagnoses: [
        { rank: 1, diagnosis_id: 11 },
        // rank2 removed
      ],
    });
    expect(computeWasUpdated(basePre, post)).toBe(true);
  });
});
