import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// Mock supabase before importing App — avoids real client instantiation
vi.mock("../supabase.js", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
  getProfile: vi.fn().mockResolvedValue(null),
}));

// Mock heavy page components to keep tests focused on App routing
vi.mock("../pages/LoginPage.jsx", () => ({
  default: () => <div data-testid="login-page">Login</div>,
}));
vi.mock("../pages/ToolPage.jsx", () => ({
  default: () => <div data-testid="tool-page">Tool</div>,
}));

import App from "../App.jsx";
import { supabase } from "../supabase.js";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: auth state change subscription (no-op)
  supabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
});

describe("App — auth state routing", () => {
  it("renders nothing while session is loading (getSession never resolves)", async () => {
    supabase.auth.getSession.mockReturnValue(new Promise(() => {}));
    const { container } = render(<App />);
    await act(async () => {});
    // No LoginPage or ToolPage — just the empty container
    expect(screen.queryByTestId("login-page")).toBeNull();
    expect(screen.queryByTestId("tool-page")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("renders LoginPage when there is no session", async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    await act(async () => { render(<App />); });
    expect(screen.getByTestId("login-page")).toBeDefined();
    expect(screen.queryByTestId("tool-page")).toBeNull();
  });

  it("renders ToolPage when a session exists", async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
    await act(async () => { render(<App />); });
    expect(screen.getByTestId("tool-page")).toBeDefined();
    expect(screen.queryByTestId("login-page")).toBeNull();
  });

  it("calls subscription.unsubscribe on unmount", async () => {
    const unsubscribe = vi.fn();
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    });
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    let unmount;
    await act(async () => { ({ unmount } = render(<App />)); });
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
