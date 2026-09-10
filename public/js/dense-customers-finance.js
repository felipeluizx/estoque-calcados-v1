(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc2=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));

  function customerData(id){
    const c=(state.customers||[]).find(x=>Number(x.id)===Number(id));
    if(!c)return null;
    const prod=(state.production||[]).filter(i=>Number(i.customer_id)===Number(id)&&Number(i.quantity_remaining)>0);
    const rec=(state.receivables||[]).filter(r=>Number(r.customer_id)===Number(id)&&Number(r.amount_remaining)>0);
    return {c,orders:new Set(prod.map(i=>i.order_id)).size,boxes:prod.reduce((s,i)=>s+Number(i.quantity_remaining||0),0),open:rec.reduce((s,r)=>s+Number(r.amount_remaining||0),0)};
  }

  function denseCustomers(){
    if(!matchMedia('(max-width:760px)').matches)return;
    $$('#customerList [data-customer-id]').forEach(row=>{
      const id=Number(row.dataset.customerId),d=customerData(id);if(!d)return;
      row.classList.add('customer-dense-row');
      row.innerHTML=`<div class="dense-main"><strong>${esc2(d.c.name)}</strong><span>${esc2(d.c.phone||'Sem telefone')}</span></div><div class="dense-customer-stats"><span>${d.orders} ped.</span><span>${d.boxes} CX</span><strong class="money-private">${brl(d.open)}</strong></div><span class="dense-arrow">›</span>`;
      row.onclick=()=>openCustomerDetail(id);
    });
    if(typeof applyPrefs==='function')applyPrefs();
  }

  function denseFinance(){
    if(!matchMedia('(max-width:760px)').matches)return;
    $$('#financeList [data-receivable-id]').forEach(row=>{
      const id=Number(row.dataset.receivableId),r=(state.receivables||[]).find(x=>Number(x.id)===id);if(!r)return;
      row.classList.add('finance-dense-row');
      row.innerHTML=`<div class="dense-main"><strong>${esc2(r.customer_name||'Cliente')}</strong><span>${esc2(r.description||('Cobrança #'+id))}</span></div><div class="dense-finance-value"><strong class="money-private">${brl(r.amount_remaining)}</strong><span>restante</span></div><span class="dense-arrow">›</span>`;
      row.onclick=()=>openFinanceDetail(id);
    });
    if(typeof applyPrefs==='function')applyPrefs();
  }

  function wrap(name,after){
    const old=window[name];if(typeof old!=='function'||old.__denseWrapped)return;
    const fn=function(...args){const r=old.apply(this,args);queueMicrotask(after);return r};fn.__denseWrapped=true;window[name]=fn;
  }
  function install(){wrap('renderCustomers',denseCustomers);wrap('renderFinance',denseFinance);denseCustomers();denseFinance()}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
  addEventListener('resize',()=>{denseCustomers();denseFinance()});
})();
