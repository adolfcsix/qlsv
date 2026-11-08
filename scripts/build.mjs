import {cp,rm,mkdir} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
await cp('frontend','dist',{recursive:true});
await mkdir('dist/shared',{recursive:true});
await cp('shared/lookup-intents.js','dist/shared/lookup-intents.js');
// Bản build sử dụng CSS đã biên dịch; không chứa công cụ biên dịch.
for(const name of ['theme.css','layout.css','components.css'])await rm('dist/src/styles/'+name,{force:true});
console.log('Đã tạo thư mục dist/.');
