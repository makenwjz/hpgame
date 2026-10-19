const fs=require('fs');
const s=fs.readFileSync('_tmp_status.html','utf8');
// 找 renderBlock 里的 type 分派
const i = s.indexOf('function renderBlock');
console.log(s.slice(i, i+2600));
