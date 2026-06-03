import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { createEmptyConfig } from "../../lib/companyShape.js";

// Mock supabase — ToolPage calls loadConfig on mount
vi.mock("../../supabase.js", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
}));

// Mock FinancialTool — avoids rendering the 3,200-line component in unit tests
vi.mock("../FinancialTool.jsx", () => ({
  default: vi.fn(({ initialConfig }) => (
    <div
      data-testid="financial-tool"
      data-has-config={initialConfig !== null ? "true" : "false"}
    />
  )),
}));

import ToolPage from "../ToolPage.jsx";
import { loadConfig } from "../../supabase.js";

beforeEach(() => vi.clearAllMocks());

describe("ToolPage — config loading states", () => {
  it("renders nothing while loadConfig is pending", async () => {
    loadConfig.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<ToolPage userRole="CEO" />);
    await act(async () => {});
    expect(screen.queryByTestId("financial-tool")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("renders FinancialTool with the resolved config", async () => {
    const config = createEmptyConfig();
    loadConfig.mockResolvedValue(config);
    await act(async () => { render(<ToolPage userRole="CEO" />); });
    expect(screen.getByTestId("financial-tool")).toBeDefined();
    expect(screen.getByTestId("financial-tool").dataset.hasConfig).toBe("true");
  });

  it("renders FinancialTool with null config when loadConfig resolves null", async () => {
    loadConfig.mockResolvedValue(null);
    await act(async () => { render(<ToolPage userRole="CEO" />); });
    const tool = screen.getByTestId("financial-tool");
    expect(tool).toBeDefined();
    expect(tool.dataset.hasConfig).toBe("false");
  });
});
