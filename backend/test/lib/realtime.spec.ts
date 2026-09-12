import { expect } from 'chai';

import { emitNoteEvent, userChannel } from '../../src/lib/realtime';

describe('realtime', () => {
  it('scopes a channel to the user', () => {
    expect(userChannel('u1')).to.equal('user:u1');
  });

  it('emitNoteEvent never throws (fire-and-forget, safe when unconfigured)', () => {
    expect(() => emitNoteEvent('u1', 'note:created', { id: 'n1' })).to.not.throw();
    expect(() => emitNoteEvent('u1', 'notes:imported', { count: 2 })).to.not.throw();
  });
});
