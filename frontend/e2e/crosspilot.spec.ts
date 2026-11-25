import { expect, test } from "@playwright/test";

test("CrossPilot AI 全栈核心链路端到端冒烟", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText(/CrossPilot/i)).toBeVisible();

  await page.getByPlaceholder("用户名").fill("operator");
  await page.getByPlaceholder("密码").fill("crosspilot123");
  await page.getByRole("button", { name: /登录|Sign/i }).click();

  await page.waitForURL(/\/home|\/workbench/);
  await expect(page.getByText(/经营工作台|实盘|GMV/i)).toBeVisible();

  await page.goto("/docs");
  await expect(page.getByText(/技术文档与设计规范中心/i)).toBeVisible();
});
