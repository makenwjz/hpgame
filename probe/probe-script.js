// probe-script.js —— 酒馆助手脚本
// 目标：8 项环境探测 + 版本与镜像可达性
// 用法：把这个文件加入卡片的酒馆助手脚本，打开聊天即自动运行，结果打印到控制台并在右上角弹出面板。
(async () => {
  const R = (globalThis.__HPGAME_PROBE__ ||= {});
  const mark = (k, ok, detail) => { R[k] = { ok, detail }; console.log(`[probe] ${ok ? 'OK ' : 'ERR'} ${k} — ${detail}`); };

  // ---- 0. 环境版本 ----
  try {
    const tv = typeof getTavernVersion === 'function' ? getTavernVersion() : '(no helper)';
    const thv = typeof getTavernHelperVersion === 'function' ? getTavernHelperVersion() : '(no fn)';
    mark('1_st_version', true, `SillyTavern=${tv}; TavernHelper=${thv}`);
  } catch (e) { mark('1_st_version', false, String(e)); }

  // ---- 2. 远程 ES 模块 ----
  const MIRRORS = [
    'https://raw.githubusercontent.com/makenwjz/hpgame/main/probe/probe.mjs',
    'https://cdn.jsdelivr.net/gh/makenwjz/hpgame@main/probe/probe.mjs',
    'https://fastly.jsdelivr.net/gh/makenwjz/hpgame@main/probe/probe.mjs',
  ];
  let loaded = null;
  for (const url of MIRRORS) {
    try { await import(url); loaded = url; break; } catch (e) { console.warn('[probe] import 失败', url, e && e.message); }
  }
  mark('2_remote_import', !!loaded, loaded || '三个源都无法 import()（CSP/CORS/网络）');

  // ---- 3. fetch 能力 ----
  try {
    const r = await fetch(MIRRORS[0], { cache: 'no-store' });
    mark('3_fetch', r.ok, `status=${r.status} type=${r.headers.get('content-type')}`);
  } catch (e) { mark('3_fetch', false, String(e)); }

  // ---- 4. localStorage ----
  try {
    localStorage.setItem('__hp_probe', '1');
    const ok = localStorage.getItem('__hp_probe') === '1';
    localStorage.removeItem('__hp_probe');
    mark('4_localStorage', ok, ok ? '可写' : '写入后读不回');
  } catch (e) { mark('4_localStorage', false, String(e)); }

  // ---- 5. IndexedDB ----
  try {
    const ok = await new Promise(res => {
      const req = indexedDB.open('__hp_probe', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('t');
      req.onsuccess = () => { req.result.close(); indexedDB.deleteDatabase('__hp_probe'); res(true); };
      req.onerror = () => res(false);
      setTimeout(() => res(false), 3000);
    });
    mark('5_indexedDB', ok, ok ? '可打开' : '不可用');
  } catch (e) { mark('5_indexedDB', false, String(e)); }

  // ---- 6. MVU ----
  try {
    let mvu = globalThis.Mvu;
    if (!mvu && typeof waitGlobalInitialized === 'function') {
      await Promise.race([waitGlobalInitialized('Mvu'), new Promise(r => setTimeout(r, 8000))]);
      mvu = globalThis.Mvu;
    }
    const ok = !!(mvu && typeof mvu.getMvuData === 'function');
    mark('6_mvu', ok, ok ? '可用' : '未就绪（未装或超时）');
  } catch (e) { mark('6_mvu', false, String(e)); }

  // ---- 7. 变量接口 ----
  try {
    const has = ['getVariables','replaceVariables','insertOrAssignVariables','getChatMessages'].filter(k => typeof globalThis[k] === 'function');
    mark('7_helper_api', has.length > 0, has.join(',') || '无');
  } catch (e) { mark('7_helper_api', false, String(e)); }

  // ---- 8. 事件 ----
  try {
    const has = typeof eventOn === 'function' && !!globalThis.tavern_events;
    mark('8_events', has, has ? Object.keys(tavern_events).slice(0, 8).join(',') + '…' : '无 eventOn/tavern_events');
  } catch (e) { mark('8_events', false, String(e)); }

  // ---- 面板 ----
  try {
    const id = '__hp_probe_panel';
    document.getElementById(id)?.remove();
    const d = document.createElement('div');
    d.id = id;
    d.style.cssText = 'position:fixed;right:12px;top:12px;z-index:2147483000;max-width:420px;max-height:60vh;overflow:auto;' +
      'background:#14110c;color:#e9e0cc;border:1px solid #8a6f3c;padding:12px;font:12px/1.6 system-ui;white-space:pre-wrap;border-radius:6px';
    d.textContent = 'HP-Reverb 环境探针\n\n' + Object.entries(R)
      .map(([k, v]) => `${v.ok ? '✅' : '❌'} ${k}\n    ${v.detail}`).join('\n');
    d.onclick = () => d.remove();
    document.body.appendChild(d);
    console.log('[probe] 完整结果', JSON.parse(JSON.stringify(R)));
  } catch (e) { console.warn('[probe] 面板渲染失败', e); }
})();
