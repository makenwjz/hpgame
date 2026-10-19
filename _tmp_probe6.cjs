const fs=require('fs');
const s=fs.readFileSync('_tmp_status.html','utf8');
console.log('--- 56900..58300 ---');
console.log(s.slice(56900,58300));
