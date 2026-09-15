(()=>{
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const mondayOf=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());const day=x.getDay();x.setDate(x.getDate()-(day===0?6:day-1));return x};
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
  const currentMonday=()=>mondayOf(new Date());
  const weekNow=()=>iso(currentMonday());
  const weekNext=()=>iso(addDays(currentMonday(),7));
  const weekEnd=w=>{const [y,m,d]=w.split('-').map(Number);return iso(addDays(new Date(y,m-1,d),4))};
  const brDate=v=>{const [y,m,d]=String(v).split('-').map(Number);return `${pad(d)}/${pad(m)}`};
  const tokenNow=()=>sessionStorage.getItem('estoque-admin-token')||localStorage.getItem('estoque-admin-token')||'';
  let settings={intake_closed:false},view='current',installed=false;

  function weekLabel(w){return `${brDate(w)} a ${brDate(weekEnd(w))}`}
  function chosenWeek(){
    const el=$('#orderProductionWeek');
    if(el?.value==='next')return weekNext();
    if(el?.value==='current')return weekNow();
    return settings.intake_closed?weekNext():weekNow();
  }
  async function directApi(url,opts={}){
    const r=await originalFetch(url,{...opts,headers:{'content-type':'application/json',...(tokenNow()?{authorization:`Bearer ${tokenNow()}`}:{}) ,...(opts.headers||{})},cache:'no-store'});
    const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||`Erro ${r.status}`);return d;
  }

  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:input?.url||'';
    const method=String(init?.method||'GET').toUpperCase();
    if(url.includes('/api/pedidos')&&method==='POST'){
      const week=chosenWeek();
      const response=await originalFetch(input,init);
      if(response.ok){
        try{
          const data=await response.clone().json();
          if(data?.order?.id){
            await directApi('/api/semana-producao',{method:'POST',body:JSON.stringify({action:'assign_order',order_id:Number(data.order.id),production_week_start:week})});
          }
        }catch(e){console.error('Falha ao vincular semana da produção',e)}
      }
      return response;
    }
    return originalFetch(input,init);
  };

  function ensureWeekField(){
    if($('#orderProductionWeek'))return;
    const date=$('#orderDate');if(!date)return;
    const field=document.createElement('div');field.className='field production-week-field';
    field.innerHTML=`<label>Semana de produção</label><select id="orderProductionWeek"><option value="current">Esta semana · ${weekLabel(weekNow())}</option><option value="next">Próxima semana · ${weekLabel(weekNext())}</option></select><small id="orderWeekHint"></small>`;
    date.closest('.field')?.after(field);syncOrderWeekDefault();
  }
  function syncOrderWeekDefault(){
    const s=$('#orderProductionWeek');if(!s)return;s.value=settings.intake_closed?'next':'current';
    const hint=$('#orderWeekHint');if(hint)hint.textContent=settings.intake_closed?'Semana atual fechada: novos lançamentos entram na próxima semana por padrão.':'Recebimento aberto: você pode escolher esta ou a próxima semana.';
  }

  function ensurePanel(){
    if($('#productionWeekPanel'))return;
    const page=$('#page-orders'),tabs=$('#orderTabs');if(!page||!tabs)return;
    const box=document.createElement('section');box.id='productionWeekPanel';box.className='production-week-panel';
    box.innerHTML=`<div class="week-main"><div><span class="week-eyebrow">CICLO DE PRODUÇÃO</span><strong id="weekTitle"></strong><small id="weekSubtitle"></small></div><span id="weekModeBadge" class="week-mode-badge"></span></div><div class="week-actions"><select id="productionWeekView"><option value="current">Semana atual</option><option value="next">Próxima semana</option><option value="previous">Remanescentes anteriores</option><option value="all">Todas as semanas</option></select><button class="btn secondary small" id="toggleWeekIntake"></button><button class="btn primary small hidden" id="carryWeekBtn"></button></div>`;
    tabs.before(box);
    $('#productionWeekView').value=view;
    $('#productionWeekView').onchange=e=>{view=e.target.value;updatePanelText();renderScoped()};
    $('#toggleWeekIntake').onclick=toggleIntake;
    $('#carryWeekBtn').onclick=carryover;
  }

  async function loadWeekSettings(){
    const d=await directApi(`/api/semana-producao?current_week=${weekNow()}&next_week=${weekNext()}`);settings=d.settings||settings;settings.remnants=Number(d.remnants||0);settings.current=d.current||{};settings.next=d.next||{};updatePanelText();syncOrderWeekDefault();
  }
  function updatePanelText(){
    ensurePanel();const title=$('#weekTitle'),sub=$('#weekSubtitle'),badge=$('#weekModeBadge'),toggle=$('#toggleWeekIntake'),carry=$('#carryWeekBtn');if(!title)return;
    const names={current:`Semana atual · ${weekLabel(weekNow())}`,next:`Próxima semana · ${weekLabel(weekNext())}`,previous:'Remanescentes de semanas anteriores',all:'Todas as semanas'};
    title.textContent=names[view]||names.current;
    const count=view==='current'?Number(settings.current?.pending||0):view==='next'?Number(settings.next?.pending||0):null;
    sub.textContent=count===null?'Visualização operacional por semana.':`${count} caixa${count===1?'':'s'} ainda para produzir nesta semana.`;
    badge.textContent=settings.intake_closed?'SEMANA FECHADA':'RECEBIMENTO ABERTO';badge.classList.toggle('closed',!!settings.intake_closed);
    toggle.textContent=settings.intake_closed?'Reabrir recebimento desta semana':'Fechar pedidos desta semana';
    if(settings.remnants>0){carry.classList.remove('hidden');carry.textContent=`Trazer ${settings.remnants} remanescente${settings.remnants===1?'':'s'} para esta semana`;}else carry.classList.add('hidden');
  }
  async function toggleIntake(){
    try{await directApi('/api/semana-producao',{method:'PUT',body:JSON.stringify({intake_closed:!settings.intake_closed})});settings.intake_closed=!settings.intake_closed;updatePanelText();syncOrderWeekDefault();if(typeof toast==='function')toast(settings.intake_closed?'Semana atual fechada para novos pedidos.':'Recebimento da semana atual reaberto.')}catch(e){toast?.(e.message,true)}
  }
  async function carryover(){
    if(!confirm(`Trazer todas as caixas pendentes de semanas anteriores para a semana ${weekLabel(weekNow())}?\n\nIsso não altera financeiro, cliente, preço nem histórico de produção.`))return;
    try{const d=await directApi('/api/semana-producao',{method:'POST',body:JSON.stringify({action:'carryover',target_week:weekNow()})});if(typeof refreshData==='function')await refreshData();await loadWeekSettings();if(typeof toast==='function')toast(`${Number(d.moved||0)} caixa(s) incorporadas à semana atual.`)}catch(e){toast?.(e.message,true)}
  }

  function inView(i){
    const w=String(i?.production_week_start||'');
    if(view==='all')return true;
    if(view==='next')return w===weekNext();
    if(view==='previous')return w<weekNow()&&Number(i?.quantity_remaining||0)>0;
    return w===weekNow();
  }
  function scopedRender(name){
    const old=window[name];if(typeof old!=='function'||old.__weeklyWrapped)return;
    const fn=function(...args){
      const full=state.production;state.production=(full||[]).filter(inView);
      try{return old.apply(this,args)}finally{setTimeout(()=>{state.production=full},0)}
    };fn.__weeklyWrapped=true;window[name]=fn;
    try{if(name==='renderProduction')renderProduction=fn;if(name==='renderHome')renderHome=fn}catch{}
  }
  function renderScoped(){
    if(typeof renderProduction==='function')renderProduction();
    if(typeof renderHome==='function')renderHome();
  }

  function hookNewOrderButtons(){
    ['newOrderBtn','newOrderBtn2'].forEach(id=>$('#'+id)?.addEventListener('click',()=>setTimeout(syncOrderWeekDefault,0)));
  }
  async function install(){
    if(installed)return;installed=true;ensureWeekField();ensurePanel();hookNewOrderButtons();
    scopedRender('renderProduction');scopedRender('renderHome');
    try{await loadWeekSettings()}catch(e){console.error(e)}
    renderScoped();
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,50));
  setTimeout(install,700);
})();
