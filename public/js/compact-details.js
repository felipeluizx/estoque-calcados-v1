(()=>{
  const $=s=>document.querySelector(s), txt=el=>String(el?.textContent||'').trim();
  const makeToggle=(label='Editar')=>{const b=document.createElement('button');b.type='button';b.className='btn secondary small compact-edit-toggle';b.textContent=label;return b};
  const sectionByTitle=(root,needle)=>[...root.querySelectorAll('.detail-section')].find(s=>txt(s.querySelector('h4')).toLowerCase().includes(needle.toLowerCase()));
  function setExpanded(section,on){if(!section)return;section.classList.toggle('compact-expanded',on);section.classList.toggle('compact-collapsed',!on)}
  function formatDate(v){if(!v)return '—';const p=String(v).slice(0,10).split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:v}
  function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  function compactProduct(){
    const root=$('#productDetailBody');if(!root||!root.children.length)return;
    [...root.querySelectorAll('.detail-summary .detail-stat')].forEach(stat=>{if(txt(stat.querySelector('span')).toLowerCase().includes('preço base'))stat.remove()});
    const priceSection=sectionByTitle(root,'preço-base do sku');if(priceSection)priceSection.style.display='none';
    root.querySelectorAll('#productBreakdown [data-breakdown-id]').forEach(row=>{
      row.classList.add('compact-breakdown-row');const edit=row.querySelector('.breakdown-edit'),save=row.querySelector('.bd-save'),top=row.querySelector('.breakdown-top');if(!edit||!top)return;
      edit.classList.add('compact-inline-edit');edit.hidden=true;if(save)save.hidden=true;
      let b=row.querySelector('.bd-edit-toggle');if(!b){b=makeToggle('Editar');b.classList.add('bd-edit-toggle');const details=top.querySelector('.open-item-btn');details?top.insertBefore(b,details):top.appendChild(b)}
      b.onclick=e=>{e.stopPropagation();const on=edit.hidden;edit.hidden=!on;if(save)save.hidden=!on;b.textContent=on?'Fechar edição':'Editar';row.classList.toggle('editing',on)};
    });
    root.querySelectorAll('.detail-section').forEach(s=>s.classList.add('compact-detail-section'));
  }

  function compactItem(){
    const root=$('#itemDetailBody');if(!root||!root.children.length)return;
    const orderSec=sectionByTitle(root,'pedido e cliente'),itemSec=sectionByTitle(root,'sku e preço');[orderSec,itemSec].forEach(s=>setExpanded(s,false));
    root.querySelector('.compact-extract')?.remove();root.querySelector('.compact-toolbar.item-compact-toolbar')?.remove();
    const customer=$('#itemOrderCustomer')?.selectedOptions?.[0]?.textContent||'',priority=$('#itemOrderPriority')?.selectedOptions?.[0]?.textContent||'',date=$('#itemOrderDate')?.value||'',due=$('#itemOrderDue')?.value||'',orderNote=$('#itemOrderNotes')?.value||'',itemNote=$('#itemNotes')?.value||'';
    const meta=document.createElement('div');meta.className='compact-extract';meta.innerHTML=`<div><span>Cliente</span><strong>${escapeHtml(customer)}</strong></div><div><span>Prioridade</span><strong>${escapeHtml(priority)}</strong></div><div><span>Data</span><strong>${formatDate(date)}</strong></div><div><span>Prazo</span><strong>${formatDate(due)}</strong></div>${orderNote||itemNote?'<div class="compact-note"><span>Observação</span><strong>● Atenção</strong></div>':''}`;
    const controls=document.createElement('div');controls.className='compact-toolbar item-compact-toolbar';const editBtn=makeToggle('Editar pedido');controls.appendChild(editBtn);const summary=root.querySelector('.detail-summary');summary?.insertAdjacentElement('afterend',meta);meta.insertAdjacentElement('afterend',controls);
    editBtn.onclick=()=>{const on=!(orderSec?.classList.contains('compact-expanded'));[orderSec,itemSec].forEach(s=>setExpanded(s,on));editBtn.textContent=on?'Fechar edição':'Editar pedido'};
    root.querySelectorAll('.detail-section').forEach(s=>s.classList.add('compact-detail-section'));
  }

  function compactCustomer(){const root=$('#customerDetailBody');if(!root||!root.children.length)return;const cadastro=sectionByTitle(root,'cadastro');if(cadastro){setExpanded(cadastro,false);if(!root.querySelector('.customer-compact-toolbar')){const b=makeToggle('Editar cliente'),bar=document.createElement('div');bar.className='compact-toolbar customer-compact-toolbar';bar.appendChild(b);root.querySelector('.detail-summary')?.insertAdjacentElement('afterend',bar);b.onclick=()=>{const on=!cadastro.classList.contains('compact-expanded');setExpanded(cadastro,on);b.textContent=on?'Fechar edição':'Editar cliente'}}}root.querySelectorAll('.breakdown-row,.finance-row').forEach(r=>r.classList.add('compact-breakdown-row'));root.querySelectorAll('.detail-section').forEach(s=>s.classList.add('compact-detail-section'))}

  function compactFinance(){const root=$('#financeDetailBody');if(!root||!root.children.length)return;const edit=sectionByTitle(root,'editar cobrança');if(edit){setExpanded(edit,false);if(!root.querySelector('.finance-compact-toolbar')){const bar=document.createElement('div');bar.className='compact-toolbar finance-compact-toolbar',b=makeToggle('Editar cobrança'),pay=document.createElement('button');pay.type='button';pay.className='btn primary small';pay.textContent='+ Registrar pagamento';pay.onclick=()=>$('#fdPaymentBtn')?.click();bar.append(b,pay);root.querySelector('.detail-summary')?.insertAdjacentElement('afterend',bar);b.onclick=()=>{const on=!edit.classList.contains('compact-expanded');setExpanded(edit,on);b.textContent=on?'Fechar edição':'Editar cobrança'}}}root.querySelectorAll('.detail-section').forEach(s=>s.classList.add('compact-detail-section'))}

  function wrap(name,after){const old=window[name];if(typeof old!=='function'||old.__compactWrapped)return;const fn=function(...args){const r=old.apply(this,args);queueMicrotask(after);return r};fn.__compactWrapped=true;window[name]=fn}
  function install(){wrap('renderProductDetail',compactProduct);wrap('renderItemDetail',compactItem);wrap('renderCustomerDetail',compactCustomer);wrap('renderFinanceDetail',compactFinance)}
  document.addEventListener('DOMContentLoaded',install);
})();
