(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  let refreshing=false;

  function productMainLabel(p){
    const model=String(p?.modelo||p?.sku||'Produto').trim();
    const variation=String(p?.variacao||'').trim();
    return variation ? `${model} · ${variation}` : model;
  }
  function productSubLabel(p){
    return [p?.material,p?.grade].filter(Boolean).join(' · ');
  }
  function setText(el,value){if(el&&el.textContent!==value)el.textContent=value}
  function hasNote(item){return Boolean(String(item?.order_notes||'').trim()||String(item?.item_notes||'').trim())}
  function addNoteDot(container){
    if(!container||container.querySelector('.note-alert-dot'))return;
    const dot=document.createElement('span');
    dot.className='note-alert-dot';
    dot.title='Este pedido possui observação';
    dot.setAttribute('aria-label','Pedido com observação');
    container.appendChild(dot);
  }

  async function refreshNow(){
    if(refreshing)return;
    refreshing=true;
    const buttons=$$('.data-refresh-btn,#mobileMenuBtn');
    buttons.forEach(b=>{b.disabled=true;b.classList.add('is-refreshing')});
    try{
      if(typeof loadAll==='function') await loadAll();
      else if(typeof refreshData==='function') await refreshData();
      enhanceAll();
      if(typeof toast==='function') toast('Dados atualizados.');
    }catch(e){
      if(typeof toast==='function') toast(e?.message||'Não foi possível atualizar.',true);
    }finally{
      refreshing=false;
      buttons.forEach(b=>{b.disabled=false;b.classList.remove('is-refreshing')});
    }
  }

  function installRefresh(){
    const mobile=$('#mobileMenuBtn');
    if(mobile){
      setText(mobile,'↻');
      mobile.title='Atualizar dados';
      mobile.setAttribute('aria-label','Atualizar dados');
      mobile.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();refreshNow()},true);
    }
    if(!$('.data-refresh-btn')){
      const b=document.createElement('button');
      b.type='button';b.className='data-refresh-btn';b.title='Atualizar dados';b.setAttribute('aria-label','Atualizar dados');b.innerHTML='<span class="refresh-icon">↻</span><span class="refresh-label">Atualizar</span>';
      b.onclick=refreshNow;
      document.body.appendChild(b);
    }
  }

  function enhanceHome(){
    const production=(typeof state!=='undefined'&&Array.isArray(state.production))?state.production:[];
    $$('#homeProductionList [data-product-id]').forEach(row=>{
      const productId=Number(row.dataset.productId);
      const p=typeof productById==='function'?productById(productId):null;
      if(!p)return;
      const active=production.filter(i=>Number(i.product_id)===productId&&Number(i.quantity_remaining)>0);
      const boxes=active.reduce((sum,i)=>sum+Number(i.quantity_remaining||0),0);
      const clients=new Set(active.map(i=>Number(i.customer_id))).size;
      const productBlock=row.firstElementChild;
      const title=row.querySelector('.product-title');
      const meta=productBlock?.querySelector('.meta');
      setText(title,`${boxes} cx · ${productMainLabel(p)}`);
      const metaParts=[productSubLabel(p),`${clients} cliente${clients===1?'':'s'}`].filter(Boolean);
      setText(meta,metaParts.join(' · '));
      if(active.some(hasNote)) addNoteDot(title);
      row.classList.add('compact-production-row');
    });
  }

  function enhanceOrders(){
    const production=(typeof state!=='undefined'&&Array.isArray(state.production))?state.production:[];
    $$('#productionList [data-item-id]').forEach(row=>{
      const id=Number(row.dataset.itemId);
      const item=production.find(i=>Number(i.order_item_id)===id);
      const p=item&&typeof productById==='function'?productById(item.product_id):null;
      if(!p)return;
      const title=row.querySelector('.product-title');
      const firstMeta=row.querySelector('div:nth-child(2) .meta')||row.querySelector('.meta');
      const qty=Number(item.quantity_remaining||0);
      setText(title,`${qty} cx · ${productMainLabel(p)}`);
      setText(firstMeta,productSubLabel(p));
      if(hasNote(item)) addNoteDot(title);
      row.classList.add('compact-production-row');
    });
  }

  function enhanceItemDetail(){
    const modal=$('#itemDetailModal');
    if(!modal?.classList.contains('show'))return;
    const body=modal.querySelector('.detail-body');
    const productSelect=body?.querySelector('#itemProduct');
    if(!productSelect?.value||typeof productById!=='function')return;
    const p=productById(Number(productSelect.value));
    if(!p)return;
    setText($('#itemDetailTitle'),productMainLabel(p));
    setText($('#itemDetailSubtitle'),productSubLabel(p));
  }

  function enhanceAll(){enhanceHome();enhanceOrders();enhanceItemDetail()}

  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;enhanceAll()});
  });
  document.addEventListener('DOMContentLoaded',()=>{
    installRefresh();enhanceAll();
    observer.observe(document.body,{childList:true,subtree:true});
  });
})();