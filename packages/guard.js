/* METADATA
{
  "name": "unattended_guard",
  "description": "查询状态、只读巡检和记录断点；启停仅在人工面板操作",
  "enabledByDefault": true,
  "tools": [
    {
      "name": "guard_status",
      "description": "查询守护状态和恢复文案",
      "parameters": []
    },
    {
      "name": "check_guard",
      "description": "只读预演巡检，绝不发送恢复消息",
      "parameters": []
    },
    {
      "name": "checkpoint",
      "description": "更新已完成动作和下一步断点",
      "parameters": [
        {
          "name": "text",
          "description": "断点摘要",
          "type": "string",
          "required": true
        }
      ]
    }
  ]
}
*/
async function invoke(p){try{complete(await ToolPkg.ipc.call('unattended_guard.v01',p));}catch(e){complete({success:false,message:String(e)});}}
exports.guard_status=async function(){await invoke({op:'status'});};
exports.check_guard=async function(){await invoke({op:'check',dryRun:true});};
exports.checkpoint=async function(p){await invoke({op:'checkpoint',text:p.text});};
