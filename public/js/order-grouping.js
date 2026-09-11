(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const PREF='estoque-v2-order-view';
  let view={group:'order',valueMode:'box'};
  try{view={...view,...JSON.parse(localStorage.getItem(PREF)||'{}')}}catch{}

  const norm=s=>String(s??'').trim();
  const keyNorm=s=>norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()||'sem-info';
  function uniqueParts(values){
    const out=[];
    const normalized=[];
    for(const raw of values){
      const v=norm(raw);if(!v)continue;
      const n=keyNorm(v);if(!n)continue;
      if(normalized.some(x=>x===n||x.includes(n)||n.includes(x)))continue;
      out.push(v);normalized.push(n);
    }
    return out;
  }
  function mainProduct(p){return uniqueParts([p?.modelo||p?.sku||'Produto',p?.variacao,p?.grade]).join(' · ')}
  function modelName(p){return norm(p?.modelo)||norm(p?.sku)||'Produto'}
  function gradeName(p){return norm(p?.grade)||'Sem grade'}
  function hasNote(i){return Boolean(norm(i?.order_notes)||norm(i?.item_notes))}
  function itemByRow(row){const id=Number(row.dataset.itemId);return (state.production||[]).find(i=>Number(i.order_item_id)===id)}
  function saveView(){localStorage.setItem(PREF,JSON.stringify(view))}
  function displayValue(i){const box=Number(i?.unit_price||0);return view.valueMode==='total'?box*Number(i?.quantity_ordered||0):box}
  function valueLabel(){return view.valueMode==='total'?'total do item':'por caixa'}

  function ensureControls(){
    const sort=$('#orderSort');if(!sort)return;
    let wrap=$('.order-view-controls');
    if(!wrap){
      const host=sort.parentElement;wrap=document.createElement('div');wrap.className='order-view-controls';host.insertBefore(wrap,sort);
      const group=document.createElement('select');group.id='orderGroupBy';group.setAttribute('aria-label','Visualização dos pedidos');group.innerHTML='<option value="order">Ver por pedido</option><option value="customer">Agrupar por cliente</option><option value="sku">Agrupar por modelo + grade</option>';group.value=view.group||'order';
      wrap.append(group,sort);
      group.onchange=()=>{view.group=group.value;saveView();renderProduction()};
      sort.title='Ordenar itens';
    }else if($('#orderGroupBy')){
      $('#orderGroupBy').innerHTML='<option value="order">Ver por pedido</option><option value="customer">Agrupar por cliente</option><option value="sku">Agrupar por modelo + grade</option>';
      $('#orderGroupBy').value=view.group||'order';
    }
    if(!$('#orderValueMode')){
      const value=document.createElement('select');value.id='orderValueMode';value.setAttribute('aria-label','Exibir valor dos pedidos');value.innerHTML='<option value="box">Valor: por caixa</option><option value="total">Valor: total do item</option>';value.value=view.valueMode||'box';wrap.appendChild(value);value.onchange=()=>{view.valueMode=value.value;saveView();applyGrouping()};
    }
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
    const parts=uniqueParts([p?.material,i.customer_name,`Pedido #${i.order_id}`,`${Number(i.quantity_produced||0)}/${Number(i.quantity_ordered||0)} produzidas`]);
    if(i.unit_price!=null&&typeof money==='function')parts.push(`${money(displayValue(i))} ${valueLabel()}`);
    meta.textContent=parts.join(' · ');
    row.querySelector('.customer-col')?.classList.add('order-hide-mobile-detail');
    row.querySelector('.metric')?.classList.add('order-hide-mobile-detail');
    const price=row.querySelector('.price-col');
    if(price){const strong=price.querySelector('strong'),label=price.querySelector('.meta');if(strong)strong.textContent=i.unit_price==null?'—':money(displayValue(i));if(label)label.textContent=valueLabel();price.classList.add('order-hide-mobile-detail')}
    row.classList.add('order-super-compact');
  }

  function basicGroupInfo(item,mode){
    if(mode==='customer'){
      const rows=(state.production||[]).filter(x=>Number(x.customer_id)===Number(item.customer_id)&&Number(x.quantity_remaining)>0);
      const boxes=rows.reduce((s,x)=>s+Number(x.quantity_remaining||0),0),orders=new Set(rows.map(x=>x.order_id)).size;
      return {key:`c:${item.customer_id}`,title:item.customer_name||'Cliente',sub:`${boxes} CX pendentes · ${orders} pedido${orders===1?'':'s'}`};
    }
    return {key:`o:${item.order_id}`,title:`Pedido #${item.order_id}`,sub:[item.customer_name,item.order_date?dateBR(item.order_date):''].filter(Boolean).join(' · ')};
  }

  function renderModelGradeGroups(rows){
    const models=new Map();
    for(const row of rows){
      compactRow(row);
      const i=itemByRow(row);if(!i)continue;
      const p=productById(i.product_id),mk=keyNorm(modelName(p)),gk=keyNorm(gradeName(p));
      if(!models.has(mk))models.set(mk,{title:modelName(p),grades:new Map(),boxes:0,customers:new Set(),orders:new Set()});
      const m=models.get(mk);m.boxes+=Number(i.quantity_remaining||0);m.customers.add(i.customer_id);m.orders.add(i.order_id);
      if(!m.grades.has(gk))m.grades.set(gk,{title:gradeName(p),rows:[],boxes:0,customers:new Set(),orders:new Set(),products:new Set()});
      const g=m.grades.get(gk);g.rows.push(row);g.boxes+=Number(i.quantity_remaining||0);g.customers.add(i.customer_id);g.orders.add(i.order_id);g.products.add(i.product_id);
    }
    const frag=document.createDocumentFragment();
    for(const m of models.values()){
      const sec=document.createElement('section');sec.className='order-model-group';
      const mh=document.createElement('div');mh.className='order-model-head';
      mh.innerHTML=`<div class="sku-group-qty"><strong>${m.boxes}</strong><span>CX</span></div><div class="sku-group-copy"><strong>${esc(m.title)}</strong><span>${m.customers.size} cliente${m.customers.size===1?'':'s'} · ${m.orders.size} pedido${m.orders.size===1?'':'s'}</span></div>`;
      sec.appendChild(mh);
      for(const g of m.grades.values()){
        const grade=document.createElement('div');grade.className='order-grade-group';
        const gh=document.createElement('div');gh.className='order-grade-head';
        gh.innerHTML=`<div><span class="grade-label">GRADE</span><strong>${esc(g.title)}</strong></div><div class="grade-stats"><strong>${g.boxes} CX</strong><span>${g.customers.size} cliente${g.customers.size===1?'':'s'} · ${g.orders.size} pedido${g.orders.size===1?'':'s'} · ${g.products.size} SKU${g.products.size===1?'':'s'}</span></div>`;
        grade.appendChild(gh);g.rows.forEach(r=>grade.appendChild(r));sec.appendChild(grade);
      }
      frag.appendChild(sec);
    }
    return frag;
  }

  function applyGrouping(){
    ensureControls();
    const list=$('#productionList');if(!list)return;
    const rows=[...list.querySelectorAll('[data-item-id]')];if(!rows.length)return;
    const mode=$('#orderGroupBy')?.value||view.group||'order';view.group=mode;saveView();
    if(mode==='sku'){list.replaceChildren(renderModelGradeGroups(rows));return}
    const groups=new Map();
    rows.forEach(row=>{compactRow(row);const i=itemByRow(row);if(!i)return;const g=basicGroupInfo(i,mode);if(!groups.has(g.key))groups.set(g.key,{...g,rows:[]});groups.get(g.key).rows.push(row)});
    const frag=document.createDocumentFragment();
    for(const g of groups.values()){
      const sec=document.createElement('section');sec.className='order-group';sec.dataset.groupKey=g.key;
      const head=document.createElement('div');head.className='order-group-head';head.innerHTML=`<div><strong>${esc(g.title)}</strong><span>${esc(g.sub||'')}</span></div><span class="order-group-count">${g.rows.length} ${g.rows.length===1?'linha':'linhas'}</span>`;
      sec.appendChild(head);g.rows.forEach(r=>sec.appendChild(r));frag.appendChild(sec);
    }
    list.replaceChildren(frag);
  }

  function install(){
    ensureControls();
    const old=renderProduction;if(old?.__groupWrapped)return;
    const wrapped=function(...args){const r=old.apply(this,args);queueMicrotask(()=>{ensureControls();applyGrouping()});return r};
    wrapped.__groupWrapped=true;renderProduction=wrapped;applyGrouping();
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
})();
