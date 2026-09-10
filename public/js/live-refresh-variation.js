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

  async function refreshNow(btn){
    if(refreshing)return;
    refreshing=true;
    const buttons=$$('.data-refresh-btn,#mobileMenuBtn');
    buttons.forEach(b=>{b.disabled=true;b.classList.add('is-refreshing')});
    try{
      if(typeof loadAll==='function') await loadAll();
      else if(typeof refreshData==='function') await refreshData();
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
      mobile.textContent='↻';
      mobile.title='Atualizar dados';
      mobile.setAttribute('aria-label','Atualizar dados');
      mobile.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();refreshNow(mobile)},true);
    }
    if(!$('.data-refresh-btn')){
      const b=document.createElement('button');
      b.type='button';b.className='data-refresh-btn';b.title='Atualizar dados';b.setAttribute('aria-label','Atualizar dados');b.innerHTML='<span class="refresh-icon">↻</span><span class="refresh-label">Atualizar</span>';
      b.onclick=()=>refreshNow(b);
      document.body.appendChild(b);
    }
  }

  function enhanceHome(){
    $$('#homeProductionList [data-product-id]').forEach(row=>{
      const p=typeof productById==='function'?productById(Number(row.dataset.productId)):null;
      if(!p)return;
      const title=row.querySelector('.product-title');
      const meta=row.querySelector('.meta');
      if(title)title.textContent=productMainLabel(p);
      if(meta)meta.textContent=productSubLabel(p);
    });
  }

  function enhanceOrders(){
    $$('#productionList [data-item-id]').forEach(row=>{
      const id=Number(row.dataset.itemId);
      const item=(window.state?.production||[]).find(i=>Number(i.order_item_id)===id);
      const p=item&&typeof productById==='function'?productById(item.product_id):null;
      if(!p)return;
      const title=row.querySelector('.product-title');
      const firstMeta=row.querySelector('.meta');
      if(title)title.textContent=productMainLabel(p);
      if(firstMeta)firstMeta.textContent=productSubLabel(p);
    });
  }

  function enhanceDetail(){
    const modal=$('#itemDetailModal');
    if(modal?.classList.contains('show')){
      const title=$('#itemDetailTitle');
      const subtitle=$('#itemDetailSubtitle');
      const body=modal.querySelector('.detail-body');
      const productSelect=body?.querySelector('#itemProduct');
      let p=null;
      if(productSelect?.value&&typeof productById==='function')p=productById(Number(productSelect.value));
      if(!p){
        const pid=body?.querySelector('[data-product-id]')?.dataset?.productId;
        if(pid&&typeof productById==='function')p=productById(Number(pid));
      }
      if(p){
        if(title)title.textContent=productMainLabel(p);
        if(subtitle)subtitle.textContent=productSubLabel(p);
      }
    }
  }

  function enhanceAll(){enhanceHome();enhanceOrders();enhanceDetail()}

  const observer=new MutationObserver(()=>requestAnimationFrame(enhanceAll));
  document.addEventListener('DOMContentLoaded',()=>{
    installRefresh();enhanceAll();
    observer.observe(document.body,{childList:true,subtree:true,characterData:false});
  });
})();