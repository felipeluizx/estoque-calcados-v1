(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const PREF='estoque-v2-order-view';
  let view={group:'order'};
  try{view={...view,...JSON.parse(localStorage.getItem(PREF)||'{}')}}catch{}

  const norm=s=>String(s??'').trim();
  function uniqueParts(values){
    const out=[];
    const normalized=[];
    for(const raw of values){
      const v=norm(raw);if(!v)continue;
      const n=v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
      if(!n)continue;
      if(normalized.some(x=>x===n||x.includes(n)||n.includes(x)))continue;
      out.push(v);normalized.push(n);
    }
    return out;
  }
  function mainProduct(p){return uniqueParts([p?.modelo||p?.sku||'Produto',p?.variacao,p?.grade]).join(' · ')}
  function hasNote(i){return Boolean(norm(i?.order_notes)||norm(i?.item_notes))}
  function itemByRow(row){const id=Number(row.dataset.itemId);return (state.production||[]).find(i=>Number(i.order_item_id)===id)}

  function ensureControls(){
    if($('#orderGroupBy'))return;
    const sort=$('#orderSort');if(!sort)return;
    const host=sort.parentElement;
    const wrap=document.createElement('div');wrap.className='order-view-controls';
    const group=document.createElement('select');group.id='orderGroupBy';group.setAttribute('aria-label','Agrupar pedidos por');
    group.innerHTML='<option value="order">Agrupar por pedido</option><option value="customer">Agrupar por cliente</option><option value="sku">Agrupar por SKU</option>';
    group.value=view.group||'order';
    const sortLabel=document.createElement('span');sortLabel.className='order-sort-label';sortLabel.textContent='Ordenar';
    host.insertBefore(wrap,sort);wrap.append(group,sortLabel,sort);
    group.onchange=()=>{view.group=group.value;localStorage.setItem(PREF,JSON.stringify(view));renderProduction()};
    sort.title='Ordenar itens';
  }

  function compactRow(row){
    const i=itemByRow(row);if(!i)return;
    const p=productById(i.product_id);
    const title=row.querySelector('.product-title');
    if(title){
      title.textContent=`${Number(i.quantity_remaining||0)} CX · ${mainProduct(p)}`;
      if(hasNote(i)){const dot=document.createElement('span');dot.className='note-alert-dot';dot.title='Pedido com observação';title.appendChild(dot)}
    }
    let meta=row.querySelector('.order-compact-meta');
    if(!meta){meta=document.createElement('div');meta.className='order-compact-meta';title?.parentElement?.appendChild(meta)}
    const parts=uniqueParts([p?.material,i.customer_name,`${Number(i.quantity_produced||0)}/${Number(i.quantity_ordered||0)} produzidas`]);
    meta.textContent=parts.join(' · ');
    row.querySelector('.customer-col')?.classList.add('order-hide-mobile-detail');
    row.querySelector('.metric')?.classList.add('order-hide-mobile-detail');
    row.querySelector('.price-col')?.classList.add('order-hide-mobile-detail');
    row.classList.add('order-super-compact');
  }

  function groupInfo(item,mode){
    if(mode==='customer')return {key:`c:${item.customer_id}`,title:item.customer_name||'Cliente',sub:`${(state.production||[]).filter(x=>Number(x.customer_id)===Number(item.customer_id)&&Number(x.quantity_remaining)>0).reduce((s,x)=>s+Number(x.quantity_remaining||0),0)} CX pendentes`};
    if(mode==='sku'){
      const p=productById(item.product_id);return {key:`s:${item.product_id}`,title:mainProduct(p),sub:`${(state.production||[]).filter(x=>Number(x.product_id)===Number(item.product_id)&&Number(x.quantity_remaining)>0).reduce((s,x)=>s+Number(x.quantity_remaining||0),0)} CX pendentes`};
    }
    return {key:`o:${item.order_id}`,title:`Pedido #${item.order_id}`,sub:[item.customer_name,item.order_date?dateBR(item.order_date):''].filter(Boolean).join(' · ')};
  }

  function applyGrouping(){
    const list=$('#productionList');if(!list)return;
    const rows=[...list.children].filter(el=>el.matches?.('[data-item-id]'));
    if(!rows.length)return;
    const mode=$('#orderGroupBy')?.value||view.group||'order';
    const groups=new Map();
    rows.forEach(row=>{
      compactRow(row);
      const i=itemByRow(row);if(!i)return;
      const g=groupInfo(i,mode);
      if(!groups.has(g.key))groups.set(g.key,{...g,rows:[]});groups.get(g.key).rows.push(row);
    });
    const frag=document.createDocumentFragment();
    for(const g of groups.values()){
      const sec=document.createElement('section');sec.className='order-group';sec.dataset.groupKey=g.key;
      const head=document.createElement('div');head.className='order-group-head';head.innerHTML=`<div><strong>${esc(g.title)}</strong><span>${esc(g.sub||'')}</span></div><span class="order-group-count">${g.rows.length} ${g.rows.length===1?'item':'itens'}</span>`;
      sec.appendChild(head);g.rows.forEach(r=>sec.appendChild(r));frag.appendChild(sec);
    }
    list.replaceChildren(frag);
  }

  function install(){
    ensureControls();
    const old=renderProduction;
    if(old?.__groupWrapped)return;
    const wrapped=function(...args){const r=old.apply(this,args);queueMicrotask(()=>{ensureControls();applyGrouping()});return r};
    wrapped.__groupWrapped=true;
    renderProduction=wrapped;
    applyGrouping();
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
})();
