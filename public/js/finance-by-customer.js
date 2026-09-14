(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
  const esc2=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function groupedFinanceRows(){
    const map=new Map();
    for(const r of state.receivables||[]){
      const cid=Number(r.customer_id);
      if(!map.has(cid))map.set(cid,{customer_id:cid,customer_name:r.customer_name||'Cliente',rows:[],amount:0,paid:0,remaining:0,overdue:0});
      const g=map.get(cid);g.rows.push(r);g.amount+=Number(r.amount||0);g.paid+=Number(r.amount_paid||0)+Number(r.adjustment||0);g.remaining+=Number(r.amount_remaining||0);if(r.financial_status==='overdue'&&Number(r.amount_remaining)>0)g.overdue+=Number(r.amount_remaining||0);
    }
    return [...map.values()];
  }

  function matchesFilter(g){
    const f=state.financeFilter||'open';
    if(f==='all')return true;
    if(f==='open')return g.remaining>0;
    if(f==='overdue')return g.overdue>0;
    if(f==='paid')return g.remaining<=0&&g.rows.length>0;
    return g.rows.some(r=>r.financial_status===f);
  }

  function renderFinanceByCustomer(){
    const list=$('#financeList');if(!list)return;
    const groups=groupedFinanceRows().filter(matchesFilter).sort((a,b)=>{
      if((b.overdue>0)!==(a.overdue>0))return b.overdue-a.overdue;
      if(b.remaining!==a.remaining)return b.remaining-a.remaining;
      return String(a.customer_name).localeCompare(String(b.customer_name),'pt-BR');
    });
    list.innerHTML=groups.length?groups.map(g=>{
      const openCount=g.rows.filter(r=>Number(r.amount_remaining)>0).length;
      const status=g.overdue>0?`<span class="finance-customer-badge overdue">VENCIDO</span>`:g.remaining>0?`<span class="finance-customer-badge open">EM ABERTO</span>`:`<span class="finance-customer-badge paid">QUITADO</span>`;
      return `<div class="finance-row finance-customer-row" data-finance-customer-id="${g.customer_id}"><div class="finance-customer-main"><div class="row-title">${esc2(g.customer_name)}</div><div class="row-sub">${g.rows.length} lançamento${g.rows.length===1?'':'s'}${openCount?` · ${openCount} em aberto`:''}</div>${status}</div><div class="secondary-col"><div class="row-title money-private">${brl(g.paid)}</div><div class="row-sub">pago</div></div><div class="money-col"><div class="row-title money-private ${g.overdue>0?'danger':''}">${brl(g.remaining)}</div><div class="row-sub">${g.overdue>0?`${brl(g.overdue)} vencido`:(g.remaining>0?'a receber':'quitado')}</div></div><div>›</div></div>`;
    }).join(''):'<div class="empty">Nenhum cliente neste filtro.</div>';
    $$('#financeList [data-finance-customer-id]').forEach(row=>row.onclick=()=>openCustomerDetail(Number(row.dataset.financeCustomerId)));
    if(typeof applyPrefs==='function')applyPrefs();
  }

  function install(){
    const old=window.renderFinance;if(typeof old!=='function'||old.__customerGrouped)return;
    const wrapped=function(...args){const r=old.apply(this,args);queueMicrotask(renderFinanceByCustomer);return r};
    wrapped.__customerGrouped=true;window.renderFinance=wrapped;
    renderFinanceByCustomer();
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
  setTimeout(install,500);
})();
