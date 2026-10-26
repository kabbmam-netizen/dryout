-- ============================================================================
-- VibeDistill / DRYOUT 内容切片机 — Supabase 初始化脚本
-- ----------------------------------------------------------------------------
-- 用法：Supabase Dashboard → SQL Editor → New query → 全选粘贴 → Run
-- 幂等：可重复执行。脚本会先删掉同名旧表再重建，因此重复执行得到的一定是
--       与本文件完全一致的结构；代价是表中已有数据会被清空。
--       如果表里已有要保留的数据，先备份，不要直接跑。
--
-- 为什么不用 create table if not exists：它只判断表在不在，不会给已存在的
-- 表补列。若库里已有一张旧结构的 distill_cards（比如早前试跑留下的），
-- 建表语句会被跳过，后续 insert 就会报 42703 column "meta" does not exist。
--
-- 执行前想确认现有结构，可单独跑：
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'distill_cards'
--   order by ordinal_position;
--
-- 字段与前端 src/data/mockCards.js、src/lib/distill.js 的卡片对象一一对应：
--   前端字段            →  数据库列
--   id                  →  id
--   title               →  title
--   sourceType          →  source_type   ('podcast' | 'bilibili' | 'article')
--   sourceName          →  source_name
--   sourceUrl           →  source_url
--   sourceAssets[]      →  source_assets (jsonb)
--   meta                →  meta
--   golden_quote        →  golden_quote
--   one_line_summary    →  one_line_summary
--   key_takeaways[]     →  key_takeaways (text[])
--   tags[]              →  tags (text[])
--   personal_note       →  personal_note
--   starred             →  starred
--   createdAt           →  created_at
--   noteUpdatedAt       →  note_updated_at
--
-- 新增两个前端不感知的列，仅服务于权限：
--   user_id   归属用户；预置演示卡片为 null
--   is_public 是否允许未登录访客读取；默认 true
--
-- 馆藏编号 DRY—NNN 刻意不落库：前端拿到全量列表后按 created_at 升序分配，
-- 最早的 6 张预置卡固定为 DRY—001 … DRY—006，新卡片依次递增到 007、008，
-- 且与分类/标签/搜索筛选无关。因此这里不需要 serial 或 display_code 列。
--
-- 个人星标与批注不在本表：见 supabase/02_personal_state.sql，
-- 那张表按 (user_id, card_id) 存每个人的状态，与卡片内容分离。
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. 表结构
--    先删除旧表：早前试跑可能留下结构不全的 distill_cards，cascade 会一并
--    清掉它的索引与策略，保证下面建出来的就是本文件定义的版本。
-- ---------------------------------------------------------------------------
drop table if exists public.distill_cards cascade;

create table public.distill_cards (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users (id) on delete cascade,

  title            text        not null,
  source_type      text        not null check (source_type in ('podcast', 'bilibili', 'article')),
  source_name      text        not null default '',
  source_url       text        not null default '',
  source_assets    jsonb       not null default '[]'::jsonb,
  meta             text        not null default '',

  golden_quote     text        not null,
  one_line_summary text        not null,
  key_takeaways    text[]      not null default '{}',
  tags             text[]      not null default '{}',

  personal_note    text        not null default '',
  starred          boolean     not null default false,
  is_public        boolean     not null default true,

  created_at       timestamptz not null default now(),
  note_updated_at  timestamptz
);

comment on table  public.distill_cards               is '长内容脱水后的归档卡片；user_id 为 null 的为公开演示数据';
comment on column public.distill_cards.source_type   is '来源介质：podcast 播客 / bilibili 视频 / article 深度长文';
comment on column public.distill_cards.meta          is '展示用元信息，如「14 分钟阅读」「72 分钟」「18:24」';
comment on column public.distill_cards.source_assets is '本地附件的元信息数组，元素形如 {"kind","name","size","duration","cueCount"}，不含文件本体';
comment on column public.distill_cards.key_takeaways is '三段式论据，按顺序渲染为 01—03';
comment on column public.distill_cards.note_updated_at is '个人批注最后保存时间；未修改过为 null';

create index if not exists distill_cards_created_at_idx on public.distill_cards (created_at desc);
create index if not exists distill_cards_user_id_idx    on public.distill_cards (user_id);
create index if not exists distill_cards_tags_idx       on public.distill_cards using gin (tags);


-- ---------------------------------------------------------------------------
-- 2. 行级安全（RLS）
--    访客：只能读 is_public = true 的卡片
--    登录用户：可读全部公开卡片 + 自己的私密卡片，只能增删改自己的卡片
-- ---------------------------------------------------------------------------
alter table public.distill_cards enable row level security;

drop policy if exists "cards_select_public_or_own" on public.distill_cards;
create policy "cards_select_public_or_own"
  on public.distill_cards
  for select
  to anon, authenticated
  using (is_public or auth.uid() = user_id);

drop policy if exists "cards_insert_own" on public.distill_cards;
create policy "cards_insert_own"
  on public.distill_cards
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "cards_update_own" on public.distill_cards;
create policy "cards_update_own"
  on public.distill_cards
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cards_delete_own" on public.distill_cards;
create policy "cards_delete_own"
  on public.distill_cards
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select on public.distill_cards to anon, authenticated;
grant insert, update, delete on public.distill_cards to authenticated;


-- ---------------------------------------------------------------------------
-- 3. 预置演示数据
--    与前端 src/data/mockCards.js 的 6 张卡片逐字段一致，user_id 为 null，
--    因此对所有人可读、任何人都不可改删。
-- ---------------------------------------------------------------------------
insert into public.distill_cards (
  id, user_id, title, source_type, source_name, source_url, source_assets, meta,
  golden_quote, one_line_summary, key_takeaways, tags,
  personal_note, starred, is_public, created_at, note_updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    null,
    '注意力是被设计的：信息过载时代的自保手册',
    'article',
    '深度长文 · 5500 字',
    '',
    '[]'::jsonb,
    '14 分钟阅读',
    '你不是缺少时间，你是把注意力租给了别人的商业模式。',
    '注意力不是自律问题，而是一场关于谁来决定你看什么的产权之争。',
    array[
      '推荐算法的目标不是让你满意，而是让你停留，这两件事经常相反。',
      '高质量输入需要主动检索，而不是被动接收永无止境的信息流。',
      '给深度工作设置物理隔离，比设置 App 使用时长更有效。'
    ],
    array['注意力', '媒介', '认知'],
    '试一周：每天上午十点前不打开任何信息流。',
    true,
    true,
    '2026-10-24T02:40:00.000Z',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    null,
    '与 AI 共事的一年：从工具到同事',
    'podcast',
    '《晚点聊》Vol.128',
    '',
    '[]'::jsonb,
    '72 分钟',
    'AI 不会取代你，它只会把你本来是谁放大十倍。',
    '把 AI 当同事而不是工具，前提是你先拥有值得被放大的判断力。',
    array[
      '从写提示词转向定义问题：能说清楚要什么，比会调参数更稀缺。',
      '把 AI 放进工作流的三层：检索与整理、初稿与变体、审稿与挑错。',
      '人类真正不可替代的是取舍：在信息不全时，决定做什么、不做什么。'
    ],
    array['AI 协作', '判断力', '工作流'],
    '下次做项目复盘时，把 AI 的初稿与我的修改并排比较。',
    true,
    true,
    '2026-10-21T09:20:00.000Z',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    null,
    '为什么你的效率系统总在第三周崩塌',
    'bilibili',
    'B站 · 硬地骇客',
    '',
    '[]'::jsonb,
    '18:24',
    '真正的效率不是把日程塞满，而是给意外留出呼吸的空隙。',
    '效率系统的敌人不是懒，而是零冗余的日程表。',
    array[
      '任何没有预留缓冲的计划，都会在第一次意外之后连锁崩塌。',
      '把计划完成率换成关键事项推进率，你会更容易坚持。',
      '能被疲惫状态下的自己执行的系统，才是真正有效的系统。'
    ],
    array['效率', '时间管理', '习惯'],
    '',
    false,
    true,
    '2026-10-19T13:05:00.000Z',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    null,
    '好设计为什么总是少做一点',
    'article',
    '设计深度 · 3200 字',
    '',
    '[]'::jsonb,
    '8 分钟阅读',
    '克制不是少放东西，而是每一件留下的东西都有非在不可的理由。',
    '设计中的删减不是风格选择，而是对信息优先级负责。',
    array[
      '装饰与功能的区别，在于它是否帮助用户理解或完成任务。',
      '视觉一致性不是重复组件，而是重复清晰的决策原则。',
      '删除之前先确认层级，否则极简只会让重要信息一起消失。'
    ],
    array['设计', '克制', '产品思维'],
    '这句话也可以作为本次作品集视觉设计的检查标准。',
    false,
    true,
    '2026-10-17T06:30:00.000Z',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    null,
    '学习不是输入更多，而是留下改变',
    'podcast',
    '《组织进化论》EP.42',
    '',
    '[]'::jsonb,
    '46 分钟',
    '没有改变行为的学习，只是一场看起来很努力的娱乐。',
    '检验学习成果的不是笔记数量，而是下一次行动是否不同。',
    array[
      '知识只有进入真实决策，才从被理解的信息变成个人能力。',
      '复盘应该记录行为变化，而不是重复摘抄已经知道的概念。',
      '降低输出门槛，比继续增加输入渠道更能形成学习闭环。'
    ],
    array['学习', '复盘', '行动'],
    '',
    true,
    true,
    '2026-10-14T11:10:00.000Z',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000006',
    null,
    '工具应该让人更像自己',
    'bilibili',
    'B站 · 产品观察室',
    '',
    '[]'::jsonb,
    '12:08',
    '好工具不会替你生活，它只会把障碍拿走，让你更像自己。',
    '工具的终点不是占据用户，而是让用户更自主地离开。',
    array[
      '效率工具不应把人的价值压缩成可量化的使用时长。',
      '自动化应该消除重复劳动，而不是替人做所有判断。',
      '好的产品会增强用户的自主感，而不是制造新的依赖。'
    ],
    array['工具', '自主性', '产品'],
    '',
    false,
    true,
    '2026-10-12T08:45:00.000Z',
    null
  )
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- 4. 自检（执行后应返回 6 行、全部 is_public = true、user_id 为空）
-- ---------------------------------------------------------------------------
-- select id, title, source_type, starred, created_at
-- from public.distill_cards
-- order by created_at desc;
