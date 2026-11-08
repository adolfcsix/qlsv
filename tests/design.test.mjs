import test from 'node:test';import assert from 'node:assert/strict';import {brandMark,brandWordmark} from '../frontend/src/components/brand.js';import {readFile} from 'node:fs/promises';
const luminance=hex=>{const c=hex.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);};
test('Các cặp màu chữ chính/phụ/nút/menu đọc được ở tỷ lệ ít nhất 4.5:1',()=>{for(const [text,bg] of [['#172d4b','#f4f6fb'],['#5f6f86','#f4f6fb'],['#65748a','#ffffff'],['#ffffff','#20487c'],['#c5d6ed','#153862'],['#25466f','#ffffff'],['#765727','#faf2e3']])assert.ok(contrast(text,bg)>=4.5,`${text}/${bg}: ${contrast(text,bg)}`);});
test('Bộ nhận diện dùng một biểu tượng SVG gốc và nhận diện Lac Hong University',()=>{assert.match(brandMark(),/viewBox="0 0 64 64"/);assert.match(brandMark(),/aria-hidden="true"/);assert.match(brandWordmark(),/LAC HONG/);assert.ok(!brandWordmark().includes('UNIVERSITY MANAGEMENT'));});
test('Frontend dùng font hệ thống và asset cục bộ',async()=>{
 const html=await readFile(new URL('../frontend/index.html',import.meta.url),'utf8');
 assert.match(html,/src\/styles\/main\.css/);
 assert.ok(!html.includes('fonts.googleapis.com'));
 assert.ok(!html.includes('assets/fonts/'));
 const css=await readFile(new URL('../frontend/src/styles/main.css',import.meta.url),'utf8');
 assert.match(css, /generated\.css/);
});
