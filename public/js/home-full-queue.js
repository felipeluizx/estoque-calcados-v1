(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  function renderFullHomeQueue(){
    const list=$('#homeProductionList');
    if(!list||typeof groupedProducts!=='function')return;
    const groups=groupedProducts(true);
    list.innerHTML=groups.length?groups.map(g=>{
      const p=productById(g.product_id);
      const customers=g.customers?.size||0;
      const orders=g.orders?.size||0;
      const notes=(g.items||[]).some(i=>String(i.order_notes||i.item_notes||'').trim());
      const title=[p.modelo||p.sku||'Produto',p.variacao,p.grade].filter(Boolean).join(' · ');
      const sub=[p.material,p.sku,`${customers} cliente${customers===1?'':'s'}`,`${orders} pedido${orders===1?'':'s'}`].filter(Boolean).join(' · ');
      return `<div class="home-product-row home-full-queue-row" data-product-id="${g.product_id}"><div><div class="product-title">${esc(title)}${notes?'<span class="note-alert-dot" title="Há observação em um ou mais pedidos"></span>':''}</div><div class="meta">${esc(sub)}</div></div><div class="home-clients"><strong>${customers}</strong><div class="meta">cliente${customers===1?'':'s'}</div></div><div class="metric"><strong>${g.remaining} CX</strong><span>pendentes</span></div><div>›</div></div>`;
    }).join(''):'<div class="empty">Nenhuma produção pendente. Tudo em dia.</div>';
    $$('#homeProductionList [data-product-id]').forEach(r=>r.onclick=()=>openProductDetail(Number(r.dataset.productId)));
  }
  function install(){
    if(typeof renderHome==='function'&&!renderHome.__fullQueueWrapped){
      const old=renderHome;
      const wrapped=function(...args){const r=old.apply(this,args);queueMicrotask(renderFullHomeQueue);return r};
      wrapped.__fullQueueWrapped=true;
      renderHome=wrapped;
    }
    renderFullHomeQueue();
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
})();
