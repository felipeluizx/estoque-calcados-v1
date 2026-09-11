(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()||'sem-info';
  function buildHierarchy(){
    const active=(state.production||[]).filter(i=>Number(i.quantity_remaining)>0),models=new Map();
    for(const i of active){
      const p=productById(i.product_id),model=String(p.modelo||p.sku||'Produto').trim(),grade=String(p.grade||'Sem grade').trim(),mk=key(model),gk=key(grade);
      if(!models.has(mk))models.set(mk,{title:model,boxes:0,customers:new Set(),orders:new Set(),grades:new Map()});
      const m=models.get(mk);m.boxes+=Number(i.quantity_remaining||0);m.customers.add(i.customer_id);m.orders.add(i.order_id);
      if(!m.grades.has(gk))m.grades.set(gk,{title:grade,boxes:0,customers:new Set(),orders:new Set(),products:new Set(),items:[],variations:new Set(),materials:new Set()});
      const g=m.grades.get(gk);g.boxes+=Number(i.quantity_remaining||0);g.customers.add(i.customer_id);g.orders.add(i.order_id);g.products.add(i.product_id);g.items.push(i);if(p.variacao)g.variations.add(p.variacao);if(p.material)g.materials.add(p.material);
    }
    return [...models.values()];
  }
  function renderFullHomeQueue(){
    const list=$('#homeProductionList');if(!list)return;
    const models=buildHierarchy();
    list.innerHTML=models.length?models.map(m=>{
      const grades=[...m.grades.values()].map(g=>{
        const notes=g.items.some(i=>String(i.order_notes||i.item_notes||'').trim());
        const sub=[[...g.materials].join(', '),[...g.variations].join(', '),`${g.customers.size} cliente${g.customers.size===1?'':'s'}`,`${g.orders.size} pedido${g.orders.size===1?'':'s'}`,`${g.products.size} SKU${g.products.size===1?'':'s'}`].filter(Boolean).join(' · ');
        const only=[...g.products][0],pid=g.products.size===1?` data-product-id="${only}"`:'';
        return `<div class="home-grade-row"${pid}><div class="home-grade-copy"><span class="home-grade-label">${esc(g.title)}</span><div class="meta">${esc(sub)}${notes?' <span class="note-alert-dot" title="Há observação em um ou mais pedidos"></span>':''}</div></div><div class="home-grade-qty"><strong>${g.boxes}</strong><span>CX</span></div>${g.products.size===1?'<div class="home-grade-arrow">›</div>':'<div></div>'}</div>`;
      }).join('');
      return `<section class="home-model-group"><div class="home-model-head"><div><strong>${esc(m.title)}</strong><span>${m.customers.size} cliente${m.customers.size===1?'':'s'} · ${m.orders.size} pedido${m.orders.size===1?'':'s'}</span></div><div class="home-model-total"><strong>${m.boxes}</strong><span>CX</span></div></div><div class="home-grade-list">${grades}</div></section>`;
    }).join(''):'<div class="empty">Nenhuma produção pendente. Tudo em dia.</div>';
    $$('#homeProductionList [data-product-id]').forEach(r=>r.onclick=()=>openProductDetail(Number(r.dataset.productId)));
  }
  function install(){
    if(typeof renderHome==='function'&&!renderHome.__fullQueueWrapped){const old=renderHome;const wrapped=function(...args){const r=old.apply(this,args);queueMicrotask(renderFullHomeQueue);return r};wrapped.__fullQueueWrapped=true;renderHome=wrapped}
    renderFullHomeQueue();
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
})();
