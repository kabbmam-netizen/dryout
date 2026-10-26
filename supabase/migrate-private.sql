-- ============================================================================
-- 一次性数据迁移：把已有用户卡片从「公开」转为「私密」
-- ----------------------------------------------------------------------------
-- 背景：旧版本的 cardToRow 写的是 is_public: card.isPublic !== false，
--       而草稿里根本没有 isPublic 字段，所以每张新建卡片都默认公开，
--       匿名访客能读到别人的整张卡片（含 user_id）。
--       新版本已改为默认私密，但**存量数据不会自动改**，需要跑一次这个。
--
-- 只跑一次。重复跑会把用户后来手动公开的卡片又改回私密。
--
-- 跑完如果想让某张卡重新公开：登录后打开该卡详情，点「仅自己可见 · 点击公开」。
-- ============================================================================

-- 先看清楚会影响哪些行（建议先单独执行这一句）
-- select id, title, created_at from public.distill_cards where user_id is not null and is_public;

update public.distill_cards
set is_public = false
where user_id is not null
  and is_public = true;

-- 自检：下面应返回 0 行
-- select id, title from public.distill_cards where user_id is not null and is_public;
