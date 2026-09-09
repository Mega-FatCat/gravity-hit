import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve('../..'),output=path.join(root,'outputs','Stillwater'),runtime=path.resolve('node_modules/electron/dist');
await fs.mkdir(output,{recursive:true});await fs.cp(runtime,output,{recursive:true});
await fs.rename(path.join(output,'electron.exe'),path.join(output,'Stillwater.exe')).catch(async e=>{if(e.code!=='EEXIST')throw e;});
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),appDir=path.join(output,'resources',`app-stage-${stamp}`),current=path.join(output,'resources','app');
const checkpointRoot=path.join(root,'work','checkpoints'),previous=path.join(checkpointRoot,`release-before-${stamp}`);
// Only swap the application payload. Portable UserData remains in place, and
// the previous payload is recoverable instead of mixing old hashed bundles.
if(!current.startsWith(output+path.sep)||!previous.startsWith(checkpointRoot+path.sep))throw Error('Unexpected package paths');
await fs.mkdir(appDir,{recursive:true});await fs.cp('dist',path.join(appDir,'dist'),{recursive:true});
for(const file of ['desktop.cjs','preload.cjs'])await fs.copyFile(file,path.join(appDir,file));
await fs.writeFile(path.join(appDir,'package.json'),JSON.stringify({name:'stillwater',productName:'STILLWATER',version:'1.0.0',main:'desktop.cjs',description:'A quiet first-person forest ritual.'},null,2));
await fs.mkdir(checkpointRoot,{recursive:true});let backedUp=false;
try{await fs.rename(current,previous);backedUp=true;}catch(e){if(e.code!=='ENOENT')throw e;}
try{await fs.rename(appDir,current);}catch(e){if(backedUp)await fs.rename(previous,current);throw e;}
console.log('Portable Windows app:',path.join(output,'Stillwater.exe'));
if(backedUp)console.log('Previous application payload:',previous);
