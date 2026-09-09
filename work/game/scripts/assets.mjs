import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('public/assets');
await fs.mkdir(root,{recursive:true});
async function json(url){const r=await fetch(url);if(!r.ok)throw Error(`${r.status}: ${url}`);return r.json()}
async function dl(url,file){await fs.mkdir(path.dirname(file),{recursive:true});try{if((await fs.stat(file)).size>100)return;}catch{} const r=await fetch(url);if(!r.ok)throw Error(`${r.status}: ${url}`);await fs.writeFile(file,Buffer.from(await r.arrayBuffer()));console.log(path.relative(root,file));}
const records=[];
async function model(id,res='1k'){const data=await json(`https://api.polyhaven.com/files/${id}`);const spec=data.gltf[res].gltf;const dir=path.join(root,id);await dl(spec.url,path.join(dir,`${id}.gltf`));for(const [file,ref]of Object.entries(spec.include))await dl(ref.url,path.join(dir,file));records.push({id,source:`https://polyhaven.com/a/${id}`,license:'CC0',format:'gltf',resolution:res});}
async function texture(id){const data=await json(`https://api.polyhaven.com/files/${id}`);for(const [key,label] of [['Diffuse','diff'],['nor_gl','nor_gl'],['Rough','rough']]){const spec=data[key]?.['2k']?.jpg;if(spec)await dl(spec.url,path.join(root,id,`${label}.jpg`));}records.push({id,source:`https://polyhaven.com/a/${id}`,license:'CC0',resolution:'2k'});}
async function hdri(id){const data=await json(`https://api.polyhaven.com/files/${id}`);await dl(data.hdri['2k'].hdr.url,path.join(root,'forest.hdr'));records.push({id,source:`https://polyhaven.com/a/${id}`,license:'CC0',resolution:'2k'});}
const jobs=[()=>model('fern_02','2k'),()=>model('pine_tree_01'),()=>texture('leaves_forest_ground'),()=>texture('bark_brown_02'),()=>texture('rock_boulder_dry'),()=>hdri('forest_slope')];
const results=await Promise.allSettled(jobs.map(j=>j()));for(const r of results)if(r.status==='rejected')console.error(r.reason);
await fs.writeFile(path.join(root,'sources.json'),JSON.stringify(records,null,2));
