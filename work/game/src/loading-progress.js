export class LoadingProgress {
 constructor(onUpdate=()=>{}){this.onUpdate=onUpdate;this.tasks=new Map();this.lastOverall=0;this.currentStage='Starting renderer';this.activeId=null;this.startedAt=Date.now();}
 register(id,weight,label){this.tasks.set(id,{id,weight,label,progress:0,completed:0,total:0,detail:''});this.emit();return this;}
 update(id,progress,{label,completed=0,total=0,detail=''}={}){
  const task=this.tasks.get(id);if(!task)return;
  task.progress=Math.max(task.progress,Math.min(1,Math.max(0,Number(progress)||0)));
  task.completed=completed;task.total=total;
  if(label)task.label=label;
  if(detail)task.detail=detail;
  this.activeId=id;
  this.currentStage=task.label;
  this.emit();
 }
 complete(id,label){this.update(id,1,{label});}
 emit(){
  let weight=0,done=0;
  for(const task of this.tasks.values()){weight+=task.weight;done+=task.weight*task.progress;}
  const overall=weight?done/weight:0;
  this.lastOverall=Math.max(this.lastOverall,overall);
  const active=this.tasks.get(this.activeId);
  this.onUpdate({
   progress:this.lastOverall,
   percent:Math.round(this.lastOverall*100),
   stage:this.currentStage,
   detail:active?.detail??'',
   completed:active?.completed??0,
   total:active?.total??0,
   activeTask:this.activeId,
   elapsedMs:Date.now()-this.startedAt,
   tasks:[...this.tasks.values()].map(({id,label,progress})=>({id,label,progress})),
  });
 }
}
