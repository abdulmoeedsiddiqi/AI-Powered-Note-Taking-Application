import { expect } from 'chai';

import { attachIo, emitNoteEvent, userRoom } from '../../src/socket/notesEvents';

describe('notesEvents', () => {
  afterEach(() => {
    attachIo(null);
  });

  describe('userRoom', () => {
    it('namespaces the room by user id', () => {
      expect(userRoom('user-1')).to.equal('user:user-1');
    });
  });

  describe('emitNoteEvent', () => {
    it('does nothing when no io server has been attached', () => {
      expect(() => emitNoteEvent('user-1', 'note:created', { id: 'n1' })).to.not.throw();
    });

    it('emits to the room named for the given user once an io server is attached', () => {
      const emitted: { room: string; event: string; payload: unknown }[] = [];
      const fakeIo = {
        to(room: string) {
          return {
            emit(event: string, payload: unknown) {
              emitted.push({ room, event, payload });
            },
          };
        },
      };

      attachIo(fakeIo as never);
      emitNoteEvent('user-1', 'note:updated', { id: 'n1', title: 'Updated' });

      expect(emitted).to.deep.equal([
        { room: 'user:user-1', event: 'note:updated', payload: { id: 'n1', title: 'Updated' } },
      ]);
    });
  });
});
