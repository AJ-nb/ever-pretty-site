import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
const base='/ever-pretty-site';
const internal=/^\/(?:$|(?:_astro|campaign|data|products|collections|search|wishlist|cart|checkout|account|pages|blogs|source-url)(?:\/|\?|#|$))/;
const prefix=s=>typeof s==='string'&&internal.test(s)?base+s:s;
function jsonPaths(value){
 if(typeof value==='string')return prefix(value);
 if(Array.isArray(value))return value.map(jsonPaths);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[prefix(k),jsonPaths(v)]));
 return value;
}
function javascript(source){
 const ast=ts.createSourceFile('bundle.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const edits=[];
 function visit(node){
  if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||node.kind===ts.SyntaxKind.TemplateHead)&&internal.test(node.text)){
   edits.push(node.getStart(ast)+1);
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);
 for(const offset of edits.sort((a,b)=>b-a))source=source.slice(0,offset)+base+source.slice(offset);
 const checked=ts.createSourceFile('bundle.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 if(checked.parseDiagnostics.length)throw Error('Invalid prefixed JavaScript');
 return source;
}
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){
 const p=path.join(dir,entry.name);if(entry.isDirectory()){await walk(p);continue;}
 if(!/\.(html|js|css|json)$/.test(p))continue;
 let source=await fs.readFile(p,'utf8');
 if(p.endsWith('.js'))source=javascript(source);
 else if(p.endsWith('.json'))source=JSON.stringify(jsonPaths(JSON.parse(source)));
 else if(p.endsWith('.html'))source=source.replace(/(["']|&quot;|&#34;)\/(?=(?:_astro|campaign|data|products|collections|search|wishlist|cart|checkout|account|pages|blogs|source-url)(?:\/|[?#"'&])|["']|&quot;|&#34;)/g,(_,boundary)=>boundary+base+'/');
 else source=source.replace(/(url\(\s*["']?)(\/[^)"']+)/g,(_,before,url)=>before+prefix(url));
 await fs.writeFile(p,source);
}}
await walk('site');
