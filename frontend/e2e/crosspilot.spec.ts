import { expect, test } from "@playwright/test";

test("CrossPilot AI 全栈核心链路端到端冒烟", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByText(/欢迎回到 CrossPilot 业务协作工作台/i)).toBeVisible();

  await page.locator("#roleSwitcher").selectOption("manager");
  await expect(page.getByText(/实盘 GMV|今日待办/i)).toBeVisible();

  await page.goto("/docs");
  await expect(page.getByText(/交付文档中心|总需求说明书/i)).toBeVisible();
});
