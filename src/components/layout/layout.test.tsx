import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { setMockSearch } from "@/test/navigation-mock";

import { AppSidebar } from "./app-sidebar";
import { ThemeToggle } from "./theme-toggle";

vi.mock("next/navigation", () => import("@/test/navigation-mock"));

describe("sidebar navigation", () => {
  function renderSidebar() {
    return render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );
  }

  const link = (name: string) => screen.getByRole("link", { name });

  it("links to both views and marks the current one", () => {
    setMockSearch("");
    renderSidebar();

    expect(link("Customers")).toHaveAttribute("href", "/customers");
    expect(link("Pipeline")).toHaveAttribute("href", "/pipeline");
    // The navigation mock reports "/customers" as the current path.
    expect(link("Customers")).toHaveAttribute("aria-current", "page");
    expect(link("Pipeline")).not.toHaveAttribute("aria-current");
  });

  it("carries the search and filters in the query string to the other view", () => {
    const query = "q=ann&status=lead&status=active&company=Harbor+%26+Finch&sortBy=name&sortOrder=asc";
    setMockSearch(query);
    renderSidebar();

    expect(link("Pipeline")).toHaveAttribute("href", `/pipeline?${query}`);
    expect(link("Customers")).toHaveAttribute("href", `/customers?${query}`);
  });

  it("follows the query string as it changes", async () => {
    setMockSearch("q=ann");
    renderSidebar();
    expect(link("Pipeline")).toHaveAttribute("href", "/pipeline?q=ann");

    setMockSearch("status=churned");
    await waitFor(() =>
      expect(link("Pipeline")).toHaveAttribute("href", "/pipeline?status=churned"),
    );

    setMockSearch("");
    await waitFor(() => expect(link("Pipeline")).toHaveAttribute("href", "/pipeline"));
  });
});

describe("theme toggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  function renderToggle() {
    return render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <ThemeToggle />
      </ThemeProvider>,
    );
  }

  async function choose(theme: string) {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Change theme" }));
    await user.click(await screen.findByRole("menuitemradio", { name: theme }));
  }

  it("offers light, dark and system", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole("button", { name: "Change theme" }));
    const items = await screen.findAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual(["Light", "Dark", "System"]);
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toBeChecked();
  });

  it("switches the document to dark mode and back, and remembers the choice", async () => {
    renderToggle();
    expect(document.documentElement).toHaveClass("light");

    await choose("Dark");
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    expect(document.documentElement).not.toHaveClass("light");
    expect(localStorage.getItem("theme")).toBe("dark");

    await choose("Light");
    await waitFor(() => expect(document.documentElement).toHaveClass("light"));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("follows the system preference when set to System", async () => {
    renderToggle();

    await choose("System");
    // The test environment's media query stub reports a light system theme.
    await waitFor(() => expect(localStorage.getItem("theme")).toBe("system"));
    expect(document.documentElement).toHaveClass("light");
  });
});
