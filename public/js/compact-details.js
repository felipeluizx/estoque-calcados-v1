(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const txt=(el)=>String(el?.textContent||'').trim();

  function makeToggle(label='Editar'){
    const b=document.createElement('button');b.type='button';b.className='btn secondary small compact-edit-toggle';b.textContent=label;return b;
  }
  function sectionByTitle(root,needle){return [...root.querySelectorAll('.detail-section')].find(s=>txt(s.querySelector('h4')).toLowerCase().includes(needle.toLowerCase()))}
  function setExpanded(section,on){if(!section)return;section.classList.toggle('compact-expanded',on);section.classList.toggle('compact-collapsed',!on)}

  function compactProduct(){
    const root=$('#productDetailBody');if(!root||root.dataset.compactReady==='1')return;root.dataset.compactReady='1';
    [...root.querySelectorAll('.detail-summary .detail-stat')].forEach(stat=>{if(txt(stat.querySelector('span')).toLowerCase().includes('preço base'))stat.remove()});
    const priceSection=sectionByTitle(root,'preço-base do sku');if(priceSection)priceSection.style.display='none';
    root.querySelectorAll('#productBreakdown [data-breakdown-id]').forEach(row=>{
      const edit=row.querySelector('.breakdown-edit'),save=row.querySelector('.bd-save'),top=row.querySelector('.breakdown-top');
      if(!edit||!top)return;edit.classList.add('compact-inline-edit');edit.hidden=true;if(save)save.hidden=true;
      const b=makeToggle('Editar');b.classList.add('bd-edit-toggle');
      const details=top.querySelector('.open-item-btn');if(details)top.insertBefore(b,details);else top.appendChild(b);
      b.onclick=e=>{e.stopPropagation();const on=edit.hidden;edit.hidden=!on;if(save)save.hidden=!on;b.textContent=on?'Fechar edição':'Editar';row.classList.toggle('editing',on)};
      row.classList.add('compact-breakdown-row');
    });
  }

  function compactItem(){
    const root=$('#itemDetailBody');if(!root||root.dataset.compactReady==='1')return;root.dataset.compactReady='1';
    const orderSec=sectionByTitle(root,'pedido e cliente'),itemSec=sectionByTitle(root,'sku e preço');
    if(!orderSec&&!itemSec)return;
    [orderSec,itemSec].forEach(s=>setExpanded(s,false));
    const summary=root.querySelector('.detail-summary');
    const customer=$('#itemOrderCustomer')?.selectedOptions?.[0]?.textContent||'',priority=$('#itemOrderPriority')?.selectedOptions?.[0]?.textContent||'',date=$('#itemOrderDate')?.value||'',due=$('#itemOrderDue')?.value||'',orderNote=$('#itemOrderNotes')?.value||'',itemNote=$('#itemNotes')?.value||'';
    const meta=document.createElement('div');meta.className='compact-extract';meta.innerHTML=`<div><span>Cliente</span><strong>${escapeHtml(customer)}</strong></div><div><span>Prioridade</span><strong>${escapeHtml(priority)}</strong></div><div><span>Data</span><strong>${formatDate(date)}</strong></div><div><span>Prazo</span><strong>${formatDate(due)}</strong></div>${orderNote||itemNote?'<div class="compact-note"><span>Observação</span><strong>● Atenção</strong></div>':''}`;
    const controls=document.createElement('div');controls.className='compact-toolbar';const editBtn=makeToggle('Editar pedido');controls.appendChild(editBtn);
    summary?.insertAdjacentElement('afterend',meta);meta.insertAdjacentElement('afterend',controls);
    editBtn.onclick=()=>{const on=!(orderSec?.classList.contains('compact-expanded'));[orderSec,itemSec].forEach(s=>setExpanded(s,on));editBtn.textContent=on?'Fechar edição':'Editar pedido'};
    root.querySelectorAll('.detail-section').forEach(s=>s.classList.add('compact-detail-section'));
  }

  function compactCustomer(){
    const root=$('#customerDetailBody');if(!root||root.dataset.compactReady==='1')return;root.dataset.compactReady='1';
    const cadastro=sectionByTitle(root,'cadastro');if(cadastro){setExpanded(cadastro,false);const b=makeToggle('Editar cliente');const summary=root.querySelector('.detail-summary');const bar=document.createElement('div');bar.className='compact-toolbar';bar.appendChild(b);summary?.insertAdjacentElement('afterend',bar);b.onclick=()=>{const on=!cadastro.classList.contains('compact-expanded');setExpanded(cadastro,on);b.textContent=on?'Fechar edição':'Editar cliente'}}
    root.querySelectorAll('.breakdown-row,.finance-row').forEach(r=>r.classList.add('compact-breakdown-row'));root.querySelectorAll('.detail-section').forEach(s=>s.classList.add('compact-detail-section'));
  }

  function compactFinance(){
    const root=$('#financeDetailBody');if(!root||root.dataset.compactReady==='1')return;root.dataset.compactReady='1';
    const edit=sectionByTitle(root,'editar cobrança');if(edit){setExpanded(edit,false);const summary=root.querySelector('.detail-summary');const bar=document.createElement('div');bar.className='compact-toolbar';const b=makeToggle('Editar cobrança');const pay=document.createElement('button');pay.type='button';pay.className='btn primary small';pay.textContent='+ Registrar pagamento';pay.onclick=()=>$('#fdPaymentBtn')?.click();bar.append(b,pay);summary?.insertAdjacentElement('afterend',bar);b.onclick=()=>{const on=!edit.classList.contains('compact-expanded');setExpanded(edit,on);b.textContent=on?'Fechar edição':'Editar cobrança'}}
    root.querySelectorAll('.detail-section').forEach(s=>s.classList.add('compact-detail-section'));
  }

  function formatDate(v){if(!v)return '—';const p=String(v).slice(0,10).split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:v}
  function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function applyAll(){compactProduct();compactItem();compactCustomer();compactFinance()}

  function wrap(name,after){const old=window[name];if(typeof old!=='function'||old.__compactWrapped)return;const fn=function(...args){const r=old.apply(this,args);queueMicrotask(after);return r};fn.__compactWrapped=true;window[name]=fn}
  function install(){wrap('renderProductDetail',compactProduct);wrap('renderItemDetail',compactItem);wrap('renderCustomerDetail',compactCustomer);wrap('renderFinanceDetail',compactFinance);applyAll()}
  document.addEventListener('DOMContentLoaded',install);
})();