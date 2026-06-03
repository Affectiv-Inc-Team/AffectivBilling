import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import App from "../FinancialTool.jsx";
import { ROLES } from "../../lib/access.js";

// FinancialTool.jsx does not import supabase.js — no mock needed.
// It receives everything through props.

describe("FinancialTool (App) — smoke tests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders without throwing when given a null initialConfig", () => {
    // migrateConfig(null) seeds a default company internally
    expect(() =>
      render(<App initialConfig={null} userRole={ROLES.CEO} />)
    ).not.toThrow();
  });

  it("shows a Save button when onSave is provided and userRole can edit", () => {
    render(<App initialConfig={null} onSave={vi.fn()} userRole={ROLES.CEO} />);
    expect(screen.getByText("Save")).toBeDefined();
  });

  it("does not show a Save button when onSave is omitted", () => {
    render(<App initialConfig={null} userRole={ROLES.CEO} />);
    expect(screen.queryByText("Save")).toBeNull();
  });

  it("calls onSave when the Save button is clicked", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<App initialConfig={null} onSave={onSave} userRole={ROLES.CEO} />);
    await act(async () => { fireEvent.click(screen.getByText("Save")); });
    expect(onSave).toHaveBeenCalledOnce();
    // onSave receives the current v2 config blob
    const savedConfig = onSave.mock.calls[0][0];
    expect(savedConfig).toHaveProperty("version", 2);
    expect(savedConfig).toHaveProperty("companies");
  });
});
