import { expect, test } from '@playwright/test'

/**
 * 冒烟用例：不依赖 Supabase 数据，也不写入任何东西。
 * 没配环境变量时应用会渲染空画廊，这些断言依然成立。
 */
test.describe('页面骨架', () => {
  test('标题与主视觉正确渲染', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('DRYOUT — 内容切片机')
    await expect(page.locator('#hero-title')).toContainText('LONG')
    await expect(page.locator('.distill-console')).toBeVisible()
    await expect(page.locator('.account-copy b')).toHaveText('本地访客')
  })

  test('三套主题可切换并持久化', async ({ page }) => {
    await page.goto('/')
    for (const theme of ['blueprint', 'night', 'primary']) {
      await page.locator(`.theme-option--${theme}`).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(page.locator(`.theme-option--${theme}`)).toHaveAttribute('aria-pressed', 'true')
    }
    await page.locator('.theme-option--night').click()
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night')
  })
})

test.describe('投喂控制台', () => {
  test('空输入时主按钮禁用', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: '开始脱水归档' })).toBeDisabled()
  })

  test('样本一键装填标题与正文', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '样本 2 · 视频' }).click()
    await expect(page.locator('#entry-title')).toHaveValue('节奏不是快慢，是让人愿意留下来')
    expect((await page.locator('#entry-text').inputValue()).length).toBeGreaterThan(100)
    await expect(page.getByRole('button', { name: '开始脱水归档' })).toBeEnabled()
  })

  test('正文不足 20 字时主按钮保持禁用', async ({ page }) => {
    await page.goto('/')
    await page.locator('#entry-text').fill('太短了')
    await expect(page.getByRole('button', { name: '开始脱水归档' })).toBeDisabled()
  })

  test('只有出处没有文稿时给出明确提示', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('来源链接').fill('https://www.bilibili.com/video/BV1xx411c7mD')
    await page.getByRole('button', { name: '添加', exact: true }).click()
    await expect(page.locator('.origin-guidance')).toContainText('还需要至少 20 字')
    await expect(page.getByRole('button', { name: '开始脱水归档' })).toBeDisabled()
  })

  test('非法来源链接被拒绝', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('来源链接').fill('not-a-url')
    await page.getByRole('button', { name: '添加', exact: true }).click()
    await expect(page.getByText('请输入完整的 http:// 或 https:// 来源链接。')).toBeVisible()
  })
})

test.describe('响应式', () => {
  for (const [label, width, height] of [
    ['1440', 1440, 900],
    ['940', 940, 900],
    ['700', 700, 900],
    ['390', 390, 844],
  ]) {
    test(`${label} 视口无横向溢出`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.goto('/')
      await expect(page.locator('.distill-console')).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})
