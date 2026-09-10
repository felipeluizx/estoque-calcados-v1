(()=>{
  const $=s=>document.querySelector(s);
  const escHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function callDelete(url){
    return await api(url,{method:'DELETE'});
  }
  async function reloadAll(){
    if(typeof refreshData==='function') await refreshData();
    else if(typeof loadAll==='function') await loadAll();
  }
  function dangerButton(label){return `<button type="button" class="btn danger-btn small">${escHtml(label)}</button>`}

  async function decorateItemDetail(orderItemId){
    const body=$('#itemDetailBody');if(!body)return;
    const d=await api(`/api/detalhes?order_item_id=${Number(orderItemId)}`);
    if(!d?.item)return;
    body.querySelector('.delete-record-actions')?.remove();
    const section=document.createElement('section');section.className='detail-section delete-record-actions';
    section.innerHTML=`<div class="detail-section-head"><div><h4>Excluir / corrigir</h4><p>Use somente para lançamentos cadastrados incorretamente.</p></div></div><div class="detail-actions delete-actions-row">${dangerButton(`Excluir pedido #${d.item.order_id}`)}</div>${(d.movements||[]).length?`<div class="delete-movement-list"><div class="meta">Movimentações de produção</div>${d.movements.map(m=>`<div class="delete-movement-row"><span><strong>${Number(m.quantity)} cx</strong><small>${escHtml(m.created_at||'')}</small></span><button type="button" class="btn danger-btn small" data-delete-movement="${m.id}">Excluir baixa</button></div>`).join('')}</div>`:''}`;
    body.appendChild(section);
    const orderBtn=section.querySelector('.delete-actions-row button');
    orderBtn.onclick=async()=>{
      if(!confirm(`Excluir o pedido #${d.item.order_id}?\n\nIsso apaga os itens, as movimentações de produção e a cobrança automática ligada ao pedido. Esta ação não pode ser desfeita.`))return;
      try{orderBtn.disabled=true;await callDelete(`/api/pedidos?id=${d.item.order_id}`);closeModal('itemDetailModal');toast('Pedido excluído.');await reloadAll()}catch(e){toast(e.message,true)}finally{orderBtn.disabled=false}
    };
    section.querySelectorAll('[data-delete-movement]').forEach(btn=>btn.onclick=async()=>{
      const id=Number(btn.dataset.deleteMovement);if(!confirm('Excluir esta movimentação de produção? O saldo pendente será recalculado.'))return;
      try{btn.disabled=true;await callDelete(`/api/producao?id=${id}`);toast('Movimentação excluída.');await reloadAll();await decorateItemDetail(orderItemId)}catch(e){toast(e.message,true)}finally{btn.disabled=false}
    });
  }

  async function decorateFinanceDetail(receivableId){
    const body=$('#financeDetailBody');if(!body)return;
    const d=await api(`/api/detalhes?receivable_id=${Number(receivableId)}`);if(!d?.receivable)return;
    body.querySelector('.delete-record-actions')?.remove();
    const section=document.createElement('section');section.className='detail-section delete-record-actions';
    section.innerHTML=`<div class="detail-section-head"><div><h4>Excluir / corrigir</h4><p>Pagamentos devem ser excluídos antes de apagar uma cobrança que já recebeu valores.</p></div></div><div class="detail-actions delete-actions-row">${dangerButton('Excluir cobrança')}</div>${(d.payments||[]).length?`<div class="delete-movement-list"><div class="meta">Pagamentos lançados</div>${d.payments.map(p=>`<div class="delete-movement-row"><span><strong>${money(p.amount)}</strong><small>${escHtml(p.payment_date||'')} ${p.method?'· '+escHtml(p.method):''}</small></span><button type="button" class="btn danger-btn small" data-delete-payment="${p.id}">Excluir pagamento</button></div>`).join('')}</div>`:''}`;
    body.appendChild(section);
    const chargeBtn=section.querySelector('.delete-actions-row button');
    chargeBtn.onclick=async()=>{
      if(!confirm(`Excluir esta cobrança de ${money(d.receivable.amount)}? Esta ação não pode ser desfeita.`))return;
      try{chargeBtn.disabled=true;await callDelete(`/api/cobrancas?id=${receivableId}`);closeModal('financeDetailModal');toast('Cobrança excluída.');await reloadAll()}catch(e){toast(e.message,true)}finally{chargeBtn.disabled=false}
    };
    section.querySelectorAll('[data-delete-payment]').forEach(btn=>btn.onclick=async()=>{
      const id=Number(btn.dataset.deletePayment);if(!confirm('Excluir este pagamento? O saldo da cobrança será reaberto/recalculado.'))return;
      try{btn.disabled=true;await callDelete(`/api/pagamentos?id=${id}`);toast('Pagamento excluído.');await reloadAll();await decorateFinanceDetail(receivableId)}catch(e){toast(e.message,true)}finally{btn.disabled=false}
    });
  }

  function install(){
    const oldItem=window.openItemDetail;
    if(typeof oldItem==='function'&&!oldItem.__deleteWrapped){
      const wrapped=async function(id){await oldItem(id);try{await decorateItemDetail(id)}catch(e){console.error(e)}};wrapped.__deleteWrapped=true;window.openItemDetail=wrapped;
    }
    const oldFinance=window.openFinanceDetail;
    if(typeof oldFinance==='function'&&!oldFinance.__deleteWrapped){
      const wrapped=async function(id){await oldFinance(id);try{await decorateFinanceDetail(id)}catch(e){console.error(e)}};wrapped.__deleteWrapped=true;window.openFinanceDetail=wrapped;
    }
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
  setTimeout(install,500);
})();
