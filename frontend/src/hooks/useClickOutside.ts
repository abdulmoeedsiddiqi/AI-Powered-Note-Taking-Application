import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Call `onOutside` when the user interacts (mouse/touch) outside the element in
 * `ref`, or presses Escape. Used to dismiss dropdown menus. Only listens while
 * `active` is true, so it does nothing when the menu is closed.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void,
  active = true,
): void {
  const savedCallback = useRef(onOutside);
  useEffect(() => {
    savedCallback.current = onOutside;
  }, [onOutside]);

  useEffect(() => {
    if (!active) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const element = ref.current;
      if (element && !element.contains(event.target as Node)) {
        savedCallback.current();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        savedCallback.current();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [ref, active]);
}
