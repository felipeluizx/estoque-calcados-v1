(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const status=i=>{
    const remaining=Number(i?.quantity_remaining||0),produced=Number(i?.quantity_produced||0);
    if(i?.production_status==='completed'||(remaining<=0&&produced>0))return 'completed';
    if(i?.production_status==='partial'||(produced>0&&remaining>0))return 'partial';
    return 'pending';
  };
  const productText=i=>{const p=productById(i.product_id);return [p?.modelo||p?.sku,p?.variacao,p?.grade].filter(Boolean).join(' · ')};
  const metaText=i=>{const p=productById(i.product_id);return [p?.material,p?.sku,i?.customer_name,`Pedido #${i?.order_id}`].filter(Boolean).join(' · ')};

  function decorateActiveRows(){
    for(const row of $$('#productionList [data-item-id]')){
      const id=Number(row.dataset.itemId),i=(state.production||[]).find(x=>Number(x.order_item_id)===id);if(!i)continue;
      row.classList.remove('production-pending','production-partial','production-completed');
      row.classList.add(`production-${status(i)}`);
      if(status(i)==='partial'){
        const title=row.querySelector('.product-title');
        if(title&&!title.querySelector('.production-state-chip')){
          const chip=document.createElement('span');chip.className='production-state-chip partial';chip.textContent='PARCIAL';title.appendChild(chip);
        }
      }
    }
    for(const group of $$('#productionList .order-group,.order-model-group,.order-grade-group')){
      group.classList.toggle('has-partial',!!group.querySelector('.production-partial'));
    }
  }

  function renderCompleted(){
    const list=$('#productionList');if(!list)return;
    const q=String($('#searchInput')?.value||'').trim().toLowerCase();
    let rows=(state.production||[]).filter(i=>status(i)==='completed');
    if(q)rows=rows.filter(i=>[productText(i),metaText(i),i.pc].join(' ').toLowerCase().includes(q));
    rows.sort((a,b)=>String(b.order_date||'').localeCompare(String(a.order_date||''))||Number(b.order_item_id)-Number(a.order_item_id));
    list.innerHTML=rows.length?rows.map(i=>`<div class="order-row production-completed completed-history-row" data-item-id="${i.order_item_id}"><span class="completed-check">✓</span><div><div class="product-title">${esc(productText(i))}<span class="production-state-chip completed">CONCLUÍDO</span></div><div class="meta">${esc(metaText(i))}</div></div><div class="customer-col"><div class="meta">${esc(i.customer_name||'')}</div><span class="badge completed-badge">Concluído</span></div><div class="metric"><strong>${Number(i.quantity_ordered||i.quantity_produced||0)} cx</strong><span>${Number(i.quantity_produced||0)}/${Number(i.quantity_ordered||0)} produzidas</span></div><div class="price-col"><strong class="money-private">${i.unit_price==null?'—':money(i.unit_price)}</strong><div class="meta">por caixa</div></div><div>›</div></div>`).join(''):'<div class="empty">Nenhum item concluído encontrado.</div>';
    $$('#productionList [data-item-id]').forEach(r=>r.onclick=()=>openItemDetail(Number(r.dataset.itemId)));
    state.selected.clear();if(typeof updateSelection==='function')updateSelection();if(typeof applyPrefs==='function')applyPrefs();
  }

  function organizeProductDetail(d){
    const box=$('#productBreakdown');if(!box||!d?.items)return;
    const active=[],completed=[];
    for(const i of d.items){
      const row=box.querySelector(`[data-breakdown-id="${i.order_item_id}"]`);if(!row)continue;
      const st=status(i);row.classList.add(`production-${st}`);
      if(st==='partial'){
        const top=row.querySelector('.breakdown-top>div:first-child');
        if(top&&!top.querySelector('.production-state-chip')){const chip=document.createElement('span');chip.className='production-state-chip partial';chip.textContent=`PARCIAL · ${Number(i.quantity_produced||0)}/${Number(i.quantity_ordered||0)}`;top.appendChild(chip)}
      }
      (st==='completed'?completed:active).push(row);
    }
    const section=box.closest('.detail-section');
    const head=section?.querySelector('.detail-section-head h4');if(head)head.textContent='Em produção';
    const desc=section?.querySelector('.detail-section-head p');if(desc)desc.textContent=`${active.length} item(ns) ainda em produção. Itens concluídos ficam separados abaixo.`;
    box.replaceChildren(...active);
    section?.querySelector('.production-completed-section')?.remove();
    if(completed.length&&section){
      const details=document.createElement('details');details.className='production-completed-section';
      const summary=document.createElement('summary');summary.innerHTML=`<span><strong>Concluídos</strong><small>${completed.length} item(ns) finalizados</small></span><b>${completed.length}</b>`;details.appendChild(summary);
      const history=document.createElement('div');history.className='production-completed-list';completed.forEach(row=>{row.querySelector('.breakdown-edit')?.remove();row.querySelector('.action-row')?.remove();history.appendChild(row)});details.appendChild(history);section.appendChild(details);
    }
  }

  function install(){
    const oldProduction=window.renderProduction||renderProduction;
    if(typeof oldProduction==='function'&&!oldProduction.__statusUxWrapped){
      const fn=function(...args){if(state.orderFilter==='completed')return renderCompleted();const r=oldProduction.apply(this,args);queueMicrotask(decorateActiveRows);return r};
      fn.__statusUxWrapped=true;window.renderProduction=renderProduction=fn;
    }
    const oldProduct=window.renderProductDetail||renderProductDetail;
    if(typeof oldProduct==='function'&&!oldProduct.__statusUxWrapped){
      const fn=function(...args){const r=oldProduct.apply(this,args);queueMicrotask(()=>organizeProductDetail(args[0]));return r};
      fn.__statusUxWrapped=true;window.renderProductDetail=renderProductDetail=fn;
    }
    decorateActiveRows();
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
})();
