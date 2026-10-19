const fs=require('fs');
const j=JSON.parse(fs.readFileSync('_card_parse/hp_v10.1/extract/regex/08__开局创角页.json','utf8'));
fs.writeFileSync('src/ui/_ref-create.html', j.replaceString||'', 'utf8');
console.log('create page bytes', (j.replaceString||'').length);
