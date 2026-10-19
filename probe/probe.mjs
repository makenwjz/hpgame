// probe.mjs —— 环境自检模块（由 main 分支加载）
// 所有结果写进 globalThis.__HPGAME_PROBE__，由 probe-script.js 读取显示。
const R = (globalThis.__HPGAME_PROBE__ ||= {});
R['0_module_loaded'] = { ok: true, detail: 'probe.mjs 已作为 ES 模块执行' };

export function probeReport() {
  return R;
}
