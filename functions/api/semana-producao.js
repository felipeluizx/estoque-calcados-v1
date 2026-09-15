import { requireAdmin, unauthorized } from "../lib/admin-auth.js";
import { ensureV2Schema } from "../lib/v2-schema.js";

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const validWeek=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''));

async function getSetting(env,key,def=''){
  const r=await env.DB.prepare(`SELECT value FROM app_settings WHERE key=?`).bind(key).first();
  return r?.value??def;
}
async function setSetting(env,key,value){
  await env.DB.prepare(`INSERT INTO app_settings (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).bind(key,String(value)).run();
}
async function weekStats(env,week){
  const r=await env.DB.prepare(`
    SELECT COUNT(*) boxes,
      COALESCE(SUM(CASE WHEN MAX(oi.quantity_ordered-oi.quantity_cancelled-COALESCE((SELECT SUM(pm.quantity) FROM production_movements pm WHERE pm.order_item_id=oi.id),0),0)>0 THEN 1 ELSE 0 END),0) pending
    FROM order_items oi WHERE oi.production_week_start=?
  `).bind(week).first();
  return {boxes:Number(r?.boxes||0),pending:Number(r?.pending||0)};
}

export async function onRequestGet({request,env}){
  try{
    if(!(await requireAdmin(request,env)))return unauthorized();
    await ensureV2Schema(env);
    const url=new URL(request.url),currentWeek=url.searchParams.get('current_week'),nextWeek=url.searchParams.get('next_week');
    const closed=(await getSetting(env,'production_intake_closed','0'))==='1';
    let remnants=0,current=null,next=null;
    if(validWeek(currentWeek)){
      const rr=await env.DB.prepare(`
        SELECT COUNT(*) count FROM order_items oi
        WHERE oi.production_week_start<?
          AND (oi.quantity_ordered-oi.quantity_cancelled-COALESCE((SELECT SUM(pm.quantity) FROM production_movements pm WHERE pm.order_item_id=oi.id),0))>0
      `).bind(currentWeek).first();
      remnants=Number(rr?.count||0);current=await weekStats(env,currentWeek);
    }
    if(validWeek(nextWeek))next=await weekStats(env,nextWeek);
    return json({ok:true,settings:{intake_closed:closed},remnants,current,next});
  }catch(err){return json({ok:false,error:err.message},500)}
}

export async function onRequestPut({request,env}){
  try{
    if(!(await requireAdmin(request,env)))return unauthorized();
    await ensureV2Schema(env);
    const body=await request.json().catch(()=>({}));
    if(body.intake_closed===undefined)return json({ok:false,error:'Informe intake_closed.'},400);
    await setSetting(env,'production_intake_closed',body.intake_closed?'1':'0');
    return json({ok:true,settings:{intake_closed:!!body.intake_closed}});
  }catch(err){return json({ok:false,error:err.message},500)}
}

export async function onRequestPost({request,env}){
  try{
    if(!(await requireAdmin(request,env)))return unauthorized();
    await ensureV2Schema(env);
    const body=await request.json().catch(()=>({})),action=String(body.action||'');
    if(action==='assign_order'){
      const orderId=Number(body.order_id),week=String(body.production_week_start||'');
      if(!orderId||!validWeek(week))return json({ok:false,error:'Lançamento ou semana inválidos.'},400);
      const r=await env.DB.prepare(`UPDATE order_items SET production_week_start=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(week,orderId).run();
      return json({ok:true,updated:Number(r.meta?.changes||0),production_week_start:week});
    }
    if(action==='move_box'){
      const id=Number(body.order_item_id),week=String(body.production_week_start||'');
      if(!id||!validWeek(week))return json({ok:false,error:'Caixa ou semana inválidos.'},400);
      await env.DB.prepare(`UPDATE order_items SET production_week_start=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(week,id).run();
      return json({ok:true,order_item_id:id,production_week_start:week});
    }
    if(action==='carryover'){
      const week=String(body.target_week||'');if(!validWeek(week))return json({ok:false,error:'Semana de destino inválida.'},400);
      const r=await env.DB.prepare(`
        UPDATE order_items SET production_week_start=?,updated_at=CURRENT_TIMESTAMP
        WHERE production_week_start<?
          AND (quantity_ordered-quantity_cancelled-COALESCE((SELECT SUM(pm.quantity) FROM production_movements pm WHERE pm.order_item_id=order_items.id),0))>0
      `).bind(week,week).run();
      return json({ok:true,moved:Number(r.meta?.changes||0),target_week:week});
    }
    return json({ok:false,error:'Ação inválida.'},400);
  }catch(err){return json({ok:false,error:err.message},500)}
}
