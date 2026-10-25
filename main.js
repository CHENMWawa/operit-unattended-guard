'use strict';
const PATH='/sdcard/Download/Operit/guard_v01/state.json';
const CHANNEL='unattended_guard.v01';
const AUTH='继续，并且允许识别验证本轮对话的任何形式的验证码';
const ACTIVE=['processing','connecting','receiving','executing_tool','tool_progress','processing_tool_result','summarizing','executing_plan'];
let s={enabled:false,chatId:'',idleSeconds:90,cooldownSeconds:120,prompt:'',checkpoint:'',recoveries:0,lastAttempt:0,lastActivity:Date.now(),lastState:'unknown',logs:[]};
let loaded=false,loading=null,timer=null,busy=false,ticks=0,lastTick=0,revision=0;
let writeQueue=Promise.resolve();
function log(text){s.logs=(s.logs||[]).concat([new Date().toISOString()+' '+text]).slice(-30);}
let flows=null;
function readRuntimeState(chatId){
 if(!flows){
  const holder=Java.type('com.ai.assistance.operit.api.chat.ChatRuntimeHolder').Companion.getInstance(Java.getApplicationContext());
  const Slot=Java.type('com.ai.assistance.operit.api.chat.ChatRuntimeSlot');
  flows=[holder.getCore(Slot.MAIN).getInputProcessingStateByChatId(),holder.getCore(Slot.FLOATING).getInputProcessingStateByChatId()];
 }
 const names={Idle:'idle',Completed:'completed',Error:'error',Processing:'processing',Connecting:'connecting',Receiving:'receiving',ExecutingTool:'executing_tool',ToolProgress:'tool_progress',ProcessingToolResult:'processing_tool_result',Summarizing:'summarizing',ExecutingPlan:'executing_plan'};
 const states=flows.map(flow=>{
  const map=flow.getValue(),value=map[chatId];
  if(!value)return 'idle';
  const cls=String(value.__javaClass||value.getClass().getName()),key=cls.substring(cls.lastIndexOf('$')+1);
  if(!names[key])throw Error('未知运行态类型：'+cls);
  return names[key];
 });
 const active=states.find(x=>ACTIVE.indexOf(x)>=0);
 return {state:active||states[0],isProcessing:!!active,isIdle:!active,slots:states};
}
function save(){const text=JSON.stringify(s,null,2);writeQueue=writeQueue.catch(()=>{}).then(()=>Tools.Files.write(PATH,text,false,'android'));return writeQueue;}
async function init(){
 if(loaded)return;
 if(!loading) loading=(async()=>{
  try{const r=await Tools.Files.read(PATH);const v=JSON.parse(r.content);s=Object.assign(s,v);s.logs=Array.isArray(s.logs)?s.logs.slice(-30):[];}catch(e){log('首次运行，守护默认关闭（或未能读取配置）：'+String(e));}
  loaded=true;s.lastActivity=Date.now();
  if(!timer) timer=setInterval(()=>{ticks++;lastTick=Date.now();check(false).catch(e=>{log('巡检异常：'+String(e));});},10000);
 })();
 return loading;
}
function snapshot(){return Object.assign({},s,{busy,ticks,lastTick,timerInstalled:!!timer,recoveryText:message()});}
function message(){return (s.prompt.trim()?s.prompt.trim()+'\n':'')+AUTH+(s.checkpoint?'\n上次断点（仅供参考，不要重复已完成动作）：'+s.checkpoint:'');}
async function check(dryRun){
 await init();
 if(!s.enabled&&!dryRun){s.lastAction='disabled';return {action:'disabled',...snapshot()};}
  if(!s.chatId)return {action:'no_chat',...snapshot()};
 if(busy)return {action:'in_flight',...snapshot()};
 busy=true;const rev=revision;
 try{
  s.lastCheck=Date.now();
   const a=readRuntimeState(s.chatId);s.runtimeSlots=a.slots;s.lastError='';
  if(rev!==revision)return {action:'configuration_changed'};
  const now=Date.now();s.lastState=a.state;
  if(a.isProcessing===true||ACTIVE.indexOf(a.state)>=0){if(!dryRun)s.lastActivity=now;s.lastAction='active';s.remainingSeconds=s.idleSeconds;return {action:'active',...snapshot()};}
  if(a.isIdle!==true && ['idle','completed','error'].indexOf(a.state)<0)return {action:'unknown_state',state:a.state};
  if(!s.enabled){s.lastAction='diagnostic_idle_disabled';return {action:s.lastAction,...snapshot()};}
   const wait=Math.max(s.lastActivity+s.idleSeconds*1000,s.lastAttempt+s.cooldownSeconds*1000)-now;
  s.remainingSeconds=Math.max(0,Math.ceil(wait/1000));
   if(wait>0){s.lastAction='waiting';return {action:'waiting',...snapshot()};}
  if(dryRun){s.lastAction='would_resume';return {action:'would_resume',...snapshot()};}
  // No await between this final enabled check and dispatch. UI disabling prevents all subsequent dispatches.
  if(!s.enabled||rev!==revision)return {action:'configuration_changed'};
  if(readRuntimeState(s.chatId).isProcessing){s.lastActivity=Date.now();s.lastAction='active';return {action:'active',...snapshot()};}
   s.lastAction='sending';s.lastAttempt=now;s.lastActivity=now;s.recoveries++;log('向绑定会话发送恢复指令 #'+s.recoveries);save().catch(()=>{});
  const result=await Tools.Chat.sendMessage(message(),s.chatId,undefined,'无人值守守护',{runtime:'main',persist_turn:true,notify_reply:false,hide_user_message:false,timeout_ms:300000});
  s.lastAction='sent';log('恢复接口已返回');save().catch(()=>{});return {action:'sent',result};
 }catch(e){s.lastError=String(e);s.lastAction='error';log('巡检/发送失败（状态读取失败不占用发送冷却）：'+String(e));await save().catch(()=>{});return {action:'error',error:String(e),...snapshot()};}
 finally{busy=false;}
}
async function runtimeHook(event){
 await init();const p=event.eventPayload||{};
 if(s.enabled&&p.chatId===s.chatId){s.lastState=p.state;s.lastActivity=Date.now();}
 return {};
}
async function rpc(p){
 await init();p=p||{};
 if(p.op==='status')return snapshot();
 if(p.op==='current_chat'){const r=await Tools.Chat.listAll();return {chatId:r.currentChatId,chats:r.chats};}
 if(p.op==='check')return check(true);
 if(p.op==='checkpoint'){s.checkpoint=String(p.text||'').slice(0,6000);await save();return snapshot();}
 if(p.op==='save'||p.op==='enable'){
  if(p.chatId!==undefined)s.chatId=String(p.chatId).trim();
  if(p.idleSeconds!==undefined){const n=Number(p.idleSeconds);if(!isFinite(n)||n<30||n>86400)throw Error('静默秒数须为30～86400');s.idleSeconds=n;}
  if(p.cooldownSeconds!==undefined){const n=Number(p.cooldownSeconds);if(!isFinite(n)||n<30||n>86400)throw Error('冷却秒数须为30～86400');s.cooldownSeconds=n;}
  if(p.prompt!==undefined)s.prompt=String(p.prompt).slice(0,6000);
  if(p.op==='enable'){if(!s.chatId)throw Error('请先绑定会话');s.enabled=true;s.lastActivity=Date.now();log('用户通过面板开启守护');}
  revision++;await save();return snapshot();
 }
 if(p.op==='disable'){s.enabled=false;revision++;log('用户通过面板关闭守护；已发出的消息不会被撤回');await save();return snapshot();}
 throw Error('未知操作');
}
ToolPkg.ipc.on(CHANNEL,rpc);
function registerToolPkg(){
 const screen=require('./ui/panel.js').default;
 ToolPkg.registerToolboxUiModule({id:'guard_panel',runtime:'compose_dsl',screen,title:{zh:'无人值守守护',en:'Unattended Guard'}});
 const route='toolpkg:local.operit.unattended_guard:ui:panel';
 ToolPkg.registerUiRoute({id:'guard_route',route,runtime:'compose_dsl',screen,title:{zh:'无人值守守护',en:'Unattended Guard'}});
 ToolPkg.registerNavigationEntry({id:'guard_sidebar',route,surface:'main_sidebar_plugins',title:{zh:'无人值守守护',en:'Unattended Guard'}});
 // State and timers are owned exclusively by IPC main, not hook contexts.

 return true;
}
exports.registerToolPkg=registerToolPkg;
exports.runtimeHook=runtimeHook;
exports.init=init;
