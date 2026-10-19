const fs=require('fs');
const j=JSON.parse(fs.readFileSync('_card_parse/hp_v10.1/extract/regex/05__正文美化.json','utf8'));
const s=j.replaceString||'';
fs.writeFileSync('_tmp_status.html', s, 'utf8');
console.log('len', s.length);
for (const kw of ['getVariables','Mvu','parent.','window.top','TavernHelper','getMvuData','stat_data']) {
  const i = s.indexOf(kw);
  console.log(kw, i>=0 ? ('@'+i) : 'NOT FOUND');
}
