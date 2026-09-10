(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  let refreshing=false;

  function productMainLabel(p){
    const model=String(p?.modelo||p?.sku||'Produto').trim();
    const variation=String(p?.variacao||'').trim();
    return variation ? `${model} · ${variation}` : model;
  }
  function productSubLabel(p){
    return [p?.sku,p?.material,p?.grade].filter(Boolean).join(' · ');
  }
  function setText(el,value){if(el&&el.textContent!==value)el.textContent=value}

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
    $$('#homeProductionList [data-product-id]').forEach(row=>{
      const p=typeof productById==='function'?productById(Number(row.dataset.productId)):null;
      if(!p)return;
      setText(row.querySelector('.product-title'),productMainLabel(p));
      setText(row.querySelector('.meta'),productSubLabel(p));
    });
  }

  function enhanceOrders(){
    const production=(typeof state!=='undefined'&&Array.isArray(state.production))?state.production:[];
    $$('#productionList [data-item-id]').forEach(row=>{
      const id=Number(row.dataset.itemId);
      const item=production.find(i=>Number(i.order_item_id)===id);
      const p=item&&typeof productById==='function'?productById(item.product_id):null;
      if(!p)return;
      setText(row.querySelector('.product-title'),productMainLabel(p));
      setText(row.querySelector('.meta'),productSubLabel(p));
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