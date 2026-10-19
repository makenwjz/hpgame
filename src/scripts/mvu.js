// src/scripts/mvu.js —— MVU（MagVarUpdate）引导脚本
// MVU 不是 ST 扩展，而是「酒馆助手脚本」：它把自己挂到 globalThis.Mvu 上。
// 官方安装方式就是 import 它的 CDN bundle（见 MagVarUpdate/doc/tutorial.md「安装」）。
//
// 版本纪律：用固定 tag，不用 @master —— master 会漂移，卡的行为就不可复现。
const MVU_TAG = 'v0.99.0';

const MVU_SOURCES = [
  `https://cdn.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate@${MVU_TAG}/artifact/bundle.js`,
  `https://gcore.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate@${MVU_TAG}/artifact/bundle.js`,
  `https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate@${MVU_TAG}/artifact/bundle.js`,
];

function panel(msg) {
  try {
    const id = '__hp_mvu_err';
    document.getElementById(id)?.remove();
    const el = document.createElement('div');
    el.id = id;
    el.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483000;max-width:420px;padding:12px 14px;' +
      'background:#1a0f0f;color:#ffd7d7;border:1px solid #8a3c3c;border-radius:6px;font:12px/1.6 system-ui;white-space:pre-wrap';
    el.textContent = msg;
    el.onclick = () => el.remove();
    document.body.appendChild(el);
  } catch { console.error('[HP-Reverb·MVU]', msg); }
}

(async () => {
  if (globalThis.__HP_MVU_LOADING__) return;
  if (globalThis.Mvu && typeof globalThis.Mvu.getMvuData === 'function') {
    console.log('[HP-Reverb·MVU] 已就绪，跳过加载');
    return;
  }
  globalThis.__HP_MVU_LOADING__ = true;

  const errors = [];
  for (const url of MVU_SOURCES) {
    try {
      await import(/* @vite-ignore */ url);
      // MVU 会自己挂 globalThis.Mvu；给它一点时间完成初始化
      if (typeof waitGlobalInitialized === 'function') {
        await Promise.race([waitGlobalInitialized('Mvu'), new Promise(r => setTimeout(r, 8000))]);
      }
      if (globalThis.Mvu && typeof globalThis.Mvu.getMvuData === 'function') {
        console.log(`[HP-Reverb·MVU] 已加载：${url}`);
        globalThis.__HP_MVU_VERSION__ = MVU_TAG;
        globalThis.__HP_MVU_LOADING__ = false;
        return;
      }
      errors.push(`${url}\n  → 模块执行了，但 globalThis.Mvu 没有出现`);
    } catch (e) {
      errors.push(`${url}\n  → ${e && e.message ? e.message : e}`);
    }
  }

  globalThis.__HP_MVU_LOADING__ = false;
  panel(`【哈莉·波特·行间】变量系统（MVU）加载失败\n\n三个源都不可用：\n${errors.join('\n')}\n\n` +
    `没有 MVU 时：正文与检定仍会显示，但数值不会写回，状态栏读不到数据。\n` +
    `请检查网络，或在酒馆助手脚本库里手动导入 MVU。`);
  console.error('[HP-Reverb·MVU] 加载失败', errors);
})();
