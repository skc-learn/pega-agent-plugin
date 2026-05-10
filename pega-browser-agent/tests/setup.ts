/**
 * Jest Setup
 */

import { jest, describe, it, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Make Jest globals available globally
(globalThis as Record<string, unknown>).describe = describe;
(globalThis as Record<string, unknown>).it = it;
(globalThis as Record<string, unknown>).test = test;
(globalThis as Record<string, unknown>).expect = expect;
(globalThis as Record<string, unknown>).beforeEach = beforeEach;
(globalThis as Record<string, unknown>).afterEach = afterEach;
(globalThis as Record<string, unknown>).beforeAll = beforeAll;
(globalThis as Record<string, unknown>).afterAll = afterAll;
(globalThis as Record<string, unknown>).jest = jest;

// Define types for mock
type MockFunction = ReturnType<typeof jest.fn>;

interface MockStorage {
  get: MockFunction;
  set: MockFunction;
  remove?: MockFunction;
  onChanged?: {
    addListener: MockFunction;
  };
}

interface MockChrome {
  runtime: {
    sendMessage: MockFunction;
    onMessage: {
      addListener: MockFunction;
      removeListener: MockFunction;
    };
    onInstalled: {
      addListener: MockFunction;
    };
    onStartup: {
      addListener: MockFunction;
    };
  };
  storage: {
    session: MockStorage;
    sync: MockStorage;
  };
  tabs: {
    query: MockFunction;
    sendMessage: MockFunction;
    onRemoved: {
      addListener: MockFunction;
    };
    onUpdated: {
      addListener: MockFunction;
    };
  };
  sidePanel: {
    open: MockFunction;
    setPanelBehavior: MockFunction;
  };
  scripting: {
    executeScript: MockFunction;
  };
}

// Mock Chrome APIs
const mockChrome: MockChrome = {
  runtime: {
    sendMessage: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
    onStartup: {
      addListener: jest.fn(),
    },
  },
  storage: {
    session: {
      get: jest.fn<() => Promise<Record<string, unknown>>>().mockResolvedValue({}),
      set: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      remove: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    },
    sync: {
      get: jest.fn<() => Promise<Record<string, unknown>>>().mockResolvedValue({}),
      set: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      onChanged: {
        addListener: jest.fn(),
      },
    },
  },
  tabs: {
    query: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    sendMessage: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    onRemoved: {
      addListener: jest.fn(),
    },
    onUpdated: {
      addListener: jest.fn(),
    },
  },
  sidePanel: {
    open: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    setPanelBehavior: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  },
  scripting: {
    executeScript: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
  },
};

// Assign to global
(globalThis as Record<string, unknown>).chrome = mockChrome;

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
