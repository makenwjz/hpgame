const fs=require('fs');
const s=fs.readFileSync('_tmp_status.html','utf8');
for (const kw of ['function g(','const g =','root =','const root','frames','parent']) {
  let i = s.indexOf(kw);
  while (i>=0 && i < s.length) {
    console.log('=== '+kw+' @'+i+' ===');
    console.log(s.slice(Math.max(0,i-200), i+420).replace(/\n{2,}/g,'\n'));
    break;
  }
}
