const fs=require('fs');
const j=JSON.parse(fs.readFileSync('_card_parse/hp_v10.1/source/card.json','utf8'));
const s=j.data.extensions.tavern_helper.scripts[0];
// 去掉 content 看其余结构
const {content, ...rest}=s;
console.log(JSON.stringify(rest,null,1));
