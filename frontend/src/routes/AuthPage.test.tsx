// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthPage } from "./AuthPage";

describe("AuthPage", () => {
  it("defaults to the login tab and submit action", () => {
    render(<AuthPage onAuthenticated={vi.fn()} />);

    const buttons = screen.getAllByRole("button", { name: "로그인" });
    expect(buttons[0]?.className).toContain("is-active");
    expect(screen.getByRole("button", { name: "회원가입" }).className).not.toContain("is-active");
    expect(buttons[1]?.getAttribute("type")).toBe("submit");
    expect(buttons[1]?.textContent).toBe("로그인");
  });
});
