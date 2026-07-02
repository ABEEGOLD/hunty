export interface SearchBarHandle {
  focus: () => void;
  blur: () => void;
  clear: () => void;
}

export interface KeyboardShortcutsConfig {
  navigate: (path: string) => void;
  focusSearch: () => void;
  closeTopModal: () => void;
  toggleHelp: () => void;
}

let pendingPrefix: string | null = null;
let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

export function createDefaultShortcuts(
  navigate: (path: string) => void,
  focusSearch: () => void,
  closeTopModal: () => void,
  toggleHelp: () => void
): KeyboardShortcutsConfig {
  return {
    navigate,
    focusSearch,
    closeTopModal,
    toggleHelp,
  };
}

export function createKeyboardHandler(config: KeyboardShortcutsConfig) {
  return (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;

    const target = event.target as HTMLElement | null;
    const isTypingTarget =
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    const key = event.key.toLowerCase();

    if (pendingPrefix) {
      const prefix = pendingPrefix;
      pendingPrefix = null;
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }

      if (prefix === 'g') {
        if (key === 'h') {
          event.preventDefault();
          config.navigate('/');
          return;
        }
        if (key === 'c') {
          event.preventDefault();
          config.navigate('/hunty');
          return;
        }
        if (key === 'd') {
          event.preventDefault();
          config.navigate('/dashboard');
          return;
        }
      }
    }

    if (key === '?' && !isTypingTarget) {
      event.preventDefault();
      config.toggleHelp();
      return;
    }

    if (key === '/' && !isTypingTarget) {
      event.preventDefault();
      config.focusSearch();
      return;
    }

    if (key === 'escape') {
      event.preventDefault();
      config.closeTopModal();
      return;
    }

    if (!isTypingTarget && key === 'g') {
      event.preventDefault();
      pendingPrefix = 'g';
      pendingTimeout = setTimeout(() => {
        pendingPrefix = null;
        pendingTimeout = null;
      }, 1200);
    }
  };
}

export function cleanupPrefixState() {
  pendingPrefix = null;
  if (pendingTimeout) {
    clearTimeout(pendingTimeout);
    pendingTimeout = null;
  }
}
