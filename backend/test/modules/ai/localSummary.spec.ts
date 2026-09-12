import { expect } from 'chai';

import { generateLocalSummary } from '../../../src/modules/ai/localSummary';

describe('localSummary', () => {
  it('returns empty string for empty or whitespace text', () => {
    expect(generateLocalSummary('')).to.equal('');
    expect(generateLocalSummary('   \n  \t ')).to.equal('');
  });

  it('formats a single sentence with proper capitalization and trailing period', () => {
    expect(generateLocalSummary('hello world')).to.equal('Hello world.');
    expect(generateLocalSummary('already formatted.')).to.equal('Already formatted.');
  });

  it('preserves two sentences as a concise summary', () => {
    const text = 'First key point here. Second next step to take.';
    expect(generateLocalSummary(text)).to.equal('First key point here. Second next step to take.');
  });

  it('extracts the lead point and highest-scoring action item from multiple sentences', () => {
    const text = [
      'Team agreed on MVP scope for next sprint.',
      'Some background discussion happened about design.',
      'Focus on auth, CRUD, and search first.',
      'General documentation will be written later.',
    ].join(' ');

    const summary = generateLocalSummary(text);
    expect(summary).to.include('Team agreed on MVP scope for next sprint.');
    expect(summary).to.include('Focus on auth, CRUD, and search first.');
  });

  it('handles bullet-pointed task lists and cleans bullet prefixes', () => {
    const text = [
      '- Team agreed on MVP scope for next sprint',
      '- Some background chatter',
      '- Focus on auth and search first',
    ].join('\n');

    const summary = generateLocalSummary(text);
    expect(summary).to.not.include('- ');
    expect(summary).to.include('Team agreed on MVP scope for next sprint.');
    expect(summary).to.include('Focus on auth and search first.');
  });
});
