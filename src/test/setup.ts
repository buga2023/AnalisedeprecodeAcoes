import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

if (typeof globalThis.crypto === "undefined") {
  // jsdom já cobre, mas garante em ambientes mais antigos
  Object.defineProperty(globalThis, "crypto", {
    value: { randomUUID: () => Math.random().toString(36).slice(2) },
    configurable: true,
  });
}

if (!("Notification" in globalThis)) {
  class FakeNotification {
    static permission: NotificationPermission = "default";
    static requestPermission = vi.fn(async () => "granted" as NotificationPermission);
    title: string;
    options?: NotificationOptions;
    constructor(title: string, options?: NotificationOptions) {
      this.title = title;
      this.options = options;
    }
    close() {}
  }
  (globalThis as unknown as { Notification: typeof FakeNotification }).Notification = FakeNotification;
}
