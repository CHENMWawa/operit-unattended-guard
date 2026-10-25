'use strict';
function Screen(ctx){
 const [chat,setChat]=ctx.useState('chat','');
 const [idle,setIdle]=ctx.useState('idle','90');
 const [cool,setCool]=ctx.useState('cool','120');
 const [prompt,setPrompt]=ctx.useState('prompt','');
 const [status,setStatus]=ctx.useState('status','请先点“读取配置 / 刷新状态”');
 async function call(p){try{return await ToolPkg.ipc.call('unattended_guard.v01',p);}catch(e){setStatus('错误：'+String(e));await ctx.showToast(String(e));return null;}}
 function show(s){if(!s)return;setStatus('守护：'+(s.enabled?'已开启':'已关闭')+'\n绑定会话：'+s.chatId+'\n运行态：'+s.lastState+'\n巡检计数（每10秒一次，非秒数）：'+s.ticks+'\n最近结果：'+(s.lastAction||'未巡检')+'\n剩余等待秒数：'+(s.remainingSeconds===undefined?'—':s.remainingSeconds)+'\n最近错误：'+(s.lastError||'无')+'\n状态来源：主界面/悬浮窗运行时只读查询'+'\n最近巡检：'+(s.lastTick?new Date(s.lastTick).toLocaleString():'等待首轮')+'\n恢复次数：'+s.recoveries+'\n发送中：'+s.busy+'\n\n恢复文案：\n'+s.recoveryText+'\n\n日志：\n'+s.logs.slice(-6).join('\n'));}
 async function refresh(){const s=await call({op:'status'});if(s){setChat(s.chatId);setIdle(String(s.idleSeconds));setCool(String(s.cooldownSeconds));setPrompt(s.prompt);show(s);}}
 async function apply(op){show(await call({op,chatId:chat,idleSeconds:idle,cooldownSeconds:cool,prompt}));}
 return ctx.UI.LazyColumn({padding:16},[
  ctx.UI.Text({text:'无人值守守护 · v0.2',fontSize:22,bold:true}),
  ctx.UI.Text({text:'停止生成不会关闭守护；正常完成也会在静默超时后再次收到“继续”。任务完成后请关闭守护。已发送的消息不会被关闭按钮撤回。'}),
  ctx.UI.Button({text:'关闭守护（立即禁止后续恢复）',onClick:async()=>show(await call({op:'disable'}))}),
  ctx.UI.Button({text:'读取配置 / 刷新状态',onClick:refresh}),
   ctx.UI.Button({text:'诊断绑定会话（只读，不发送）',onClick:async()=>show(await call({op:'check',dryRun:true}))}),
  ctx.UI.TextField({value:chat,onValueChange:setChat,label:'绑定会话 ID'}),
  ctx.UI.Button({text:'填入当前会话 ID（填入后再保存）',onClick:async()=>{const r=await call({op:'current_chat'});if(r&&r.chatId)setChat(r.chatId);}}),
  ctx.UI.TextField({value:idle,onValueChange:setIdle,label:'会话静默后多久恢复（秒，最少30）'}),
  ctx.UI.TextField({value:cool,onValueChange:setCool,label:'两次恢复的最短间隔（秒，最少30）'}),
  ctx.UI.TextField({value:prompt,onValueChange:setPrompt,label:'附加恢复提示（可留空，验证码授权句固定追加）'}),
  ctx.UI.Button({text:'保存配置（不改变开关）',onClick:async()=>apply('save')}),
  ctx.UI.Button({text:'保存并开启守护',onClick:async()=>apply('enable')}),
  ctx.UI.Text({text:'验证码授权句只是提示词，不修改宿主工具审批；必须本人完成的验证仍需本人操作。正在执行的会话不会被强行打断。'}),
  ctx.UI.Text({text:status,fontSize:13})
 ]);
}
exports.default=Screen;
