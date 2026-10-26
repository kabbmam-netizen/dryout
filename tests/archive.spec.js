import { expect, test } from '@playwright/test'

/**
 * 画廊用例：需要 Supabase 里已有公开卡片。
 * 没配 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 时画廊为空，整组自动跳过。
 * 全部只读，不登录、不写入。
 */
test.describe('思想画廊', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // 等首屏加载结束：卡片或空状态任一出现，否则会在数据返回前就判空
    await page.locator('.archive-card, .empty-state').first().waitFor({ timeout: 20_000 })
    const count = await page.locator('.archive-card').count()
    test.skip(count === 0, '画廊为空：未配置 Supabase 或没有公开卡片')
  })

  test('渲染卡片且编号连续', async ({ page }) => {
    const cards = await page.locator('.archive-card').count()
    expect(cards).toBeGreaterThan(0)
    const codes = await page.locator('.archive-number').allInnerTexts()
    expect(codes).toHaveLength(cards)
    const expected = Array.from({ length: cards }, (_, i) => `DRY—${String(i + 1).padStart(3, '0')}`)
    expect([...codes].sort()).toEqual(expected)
  })

  test('分类筛选只保留对应来源', async ({ page }) => {
    const expected = await page.evaluate(
      () => [...document.querySelectorAll('.archive-card')].filter((c) => c.querySelector('.source-stamp').textContent.includes('PODCAST')).length,
    )
    await page.getByRole('group', { name: '按来源筛选' }).getByRole('button', { name: '播客' }).click()
    await expect(page.locator('.archive-card')).toHaveCount(expected)
  })

  test('标签筛选与顶栏徽章联动', async ({ page }) => {
    const tag = (await page.locator('.card-tags button').first().innerText()).replace('#', '').trim()
    const expected = await page.evaluate(
      (t) =>
        [...document.querySelectorAll('.archive-card')].filter((c) =>
          [...c.querySelectorAll('.card-tags button span')].some((s) => s.textContent.replace('#', '').trim() === t),
        ).length,
      tag,
    )
    await page.locator('.card-tags button').first().click()
    await expect(page.locator('.active-tag-badge')).toHaveCount(1)
    await expect(page.locator('.archive-card')).toHaveCount(expected)

    await page.locator('.active-tag-badge').click()
    await expect(page.locator('.active-tag-badge')).toHaveCount(0)
  })

  test('关键词搜索命中唯一卡片，清空后恢复', async ({ page }) => {
    const total = await page.locator('.archive-card').count()
    const title = await page.locator('.card-title').first().innerText()
    await page.locator('.global-search input').fill(title)
    await expect(page.locator('.archive-card')).toHaveCount(1)
    await page.locator('.global-search input').fill('')
    await expect(page.locator('.archive-card')).toHaveCount(total)
  })

  test('筛选后编号保持不变', async ({ page }) => {
    const before = await page.evaluate(() =>
      [...document.querySelectorAll('.archive-card')].map((c) => [c.querySelector('.card-title').textContent, c.querySelector('.archive-number').textContent]),
    )
    const map = Object.fromEntries(before)
    await page.locator('.card-tags button').first().click()
    await expect(page.locator('.active-tag-badge')).toHaveCount(1)
    const after = await page.evaluate(() =>
      [...document.querySelectorAll('.archive-card')].map((c) => [c.querySelector('.card-title').textContent, c.querySelector('.archive-number').textContent]),
    )
    for (const [title, code] of after) expect(map[title]).toBe(code)
  })
})

test.describe('详情抽屉', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('.archive-card, .empty-state').first().waitFor({ timeout: 20_000 })
    const count = await page.locator('.archive-card').count()
    test.skip(count === 0, '画廊为空，跳过抽屉用例')
    await page.locator('.card-main').first().click()
    await expect(page.locator('.detail-drawer')).toBeVisible()
  })

  test('三段式论据与藏书票配色齐全', async ({ page }) => {
    await expect(page.locator('.takeaways-section li')).toHaveCount(3)
    await expect(page.locator('.poster-theme')).toHaveCount(3)
  })

  test('ESC 关闭抽屉', async ({ page }) => {
    await page.keyboard.press('Escape')
    await expect(page.locator('.detail-drawer')).toHaveCount(0)
  })

  test('可见性与产出方式角标存在', async ({ page }) => {
    await expect(page.locator('.detail-badges .detail-badge')).toHaveCount(2)
  })
})
