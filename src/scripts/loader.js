// src/scripts/loader.js —— 卡内引导脚本（约 80 行，唯一放在卡里的代码）
// 作用：从 GitHub 加载 dist/<版本>/core.mjs，失败回退镜像，再失败弹错误卡。
// 版本纪律：只认 tag，不认分支；tag 不可变。

const CARD = '哈莉·波特·行间';
const VERSION = '0.1.0';           // 与 character_version 对齐
const ORG = 'makenwjz';
const REPO = 'hpgame';

const SOURCES = [
  `https://cdn.jsdelivr.net/gh/${ORG}/${REPO}@v${VERSION}/dist/core.mjs`,
  `https://fastly.jsdelivr.net/gh/${ORG}/${REPO}@v${VERSION}/dist/core.mjs`,
  `https://gcore.jsdelivr.net/gh/${ORG}/${REPO}@v${VERSION}/dist/core.mjs`,
  `https://raw.githubusercontent.com/${ORG}/${REPO}/v${VERSION}/dist/core.mjs`,
];

function panel(msg) {
  try {
    const id = '__hp_loader_err';
    document.getElementById(id)?.remove();
    const el = document.createElement('div');
    el.id = id;
    el.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483000;max-width:420px;padding:12px 14px;' +
      'background:#1a0f0f;color:#ffd7d7;border:1px solid #8a3c3c;border-radius:6px;font:12px/1.6 system-ui;white-space:pre-wrap';
    el.textContent = msg;
    el.onclick = () => el.remove();
    document.body.appendChild(el);
  } catch { console.error('[HP-Reverb]', msg); }
}

(async () => {
  if (globalThis.__HP_REVERB_LOADING__) return;
  globalThis.__HP_REVERB_LOADING__ = true;

  let mod = null;
  let used = null;
  const errors = [];

  for (const url of SOURCES) {
    try {
      mod = await import(/* @vite-ignore */ url);
      used = url;
      break;
    } catch (e) {
      errors.push(`${url}\n  → ${e && e.message ? e.message : e}`);
    }
  }

  if (!mod) {
    panel(`【${CARD}】核心脚本加载失败\n\n四个源都不可用：\n${errors.join('\n')}\n\n` +
      `继续用卡内世界书可以玩，但数值不会自动结算。\n请检查网络，或到 GitHub 手动下载 dist/core.mjs 后用酒馆助手脚本库导入。`);
    console.error('[HP-Reverb] 加载失败', errors);
    return;
  }

  try {
    if (typeof mod.install === 'function') await mod.install();
    console.log(`[HP-Reverb] 核心已加载：${used}`);
    globalThis.__HP_REVERB_VERSION__ = VERSION;
  } catch (e) {
    panel(`【${CARD}】核心已下载但安装失败\n\n${e && e.stack ? e.stack : e}`);
  } finally {
    globalThis.__HP_REVERB_LOADING__ = false;
  }
})();
