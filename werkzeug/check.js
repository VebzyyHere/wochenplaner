const fs=require('fs');
const path=require('path');
const h=fs.readFileSync(process.argv[2]||path.resolve(__dirname, '..', 'index.html'),'utf8');
const teile=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let ok=true;
teile.forEach((code,i)=>{ try{ new Function(code); }catch(e){ ok=false; console.log('SYNTAXFEHLER in Block '+(i+1)+': '+e.message); } });
console.log(ok?('Syntax ok ('+teile.length+' Blöcke, '+h.length+' Zeichen)'):'kaputt');
