import { requireAdmin, unauthorized } from "../lib/admin-auth.js";
import { ensureV2Schema } from "../lib/v2-schema.js";

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});

export async function onRequestGet({request,env}){
  try{
    if(!(await requireAdmin(request,env))) return unauthorized();
    await ensureV2Schema(env);
    const rows=await env.DB.prepare(`SELECT key,value FROM app_settings`).all();
    const settings={grade_size:12};
    for(const r of rows.results||[]){
      if(r.key==='grade_size') settings.grade_size=Math.max(1,Number(r.value)||12);
    }
    return json({ok:true,settings});
  }catch(err){return json({ok:false,error:err.message},500)}
}

export async function onRequestPut({request,env}){
  try{
    if(!(await requireAdmin(request,env))) return unauthorized();
    await ensureV2Schema(env);
    const body=await request.json().catch(()=>({}));
    const gradeSize=Math.floor(Number(body.grade_size));
    if(!Number.isFinite(gradeSize)||gradeSize<1||gradeSize>100) return json({ok:false,error:'Tamanho da grade deve ficar entre 1 e 100 pares.'},400);
    await env.DB.prepare(`INSERT INTO app_settings (key,value,updated_at) VALUES ('grade_size',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).bind(String(gradeSize)).run();
    return json({ok:true,settings:{grade_size:gradeSize}});
  }catch(err){return json({ok:false,error:err.message},500)}
}
