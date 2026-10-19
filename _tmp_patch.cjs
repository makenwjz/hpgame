// tools/build-card.mjs 补丁：entry.extensions 照抄原卡形状
const fs=require('fs');
const p='tools/build-card.mjs';
let t=fs.readFileSync(p,'utf8');
t=t.replace(
`    extensions: { hp_reverb: { version: 1, generated: true } },`,
`    use_regex: true,
    extensions: {
      position: 0, exclude_recursion: true, display_index: i,
      probability: 100, useProbability: true, depth: 4, selectiveLogic: 0,
      outlet_name: '', group: '', group_override: false, group_weight: 100,
      prevent_recursion: true, delay_until_recursion: false,
      scan_depth: null, match_whole_words: null, use_group_scoring: null,
      case_sensitive: null, automation_id: '', role: 0, vectorized: false,
      sticky: null, cooldown: null, delay: null,
      match_persona_description: false, match_character_description: false,
      match_character_personality: false, match_character_depth_prompt: false,
      match_scenario: false, match_creator_notes: false,
      triggers: [], ignore_budget: false,
    },`);
fs.writeFileSync(p,t,'utf8');
console.log('patched build-card.mjs');
