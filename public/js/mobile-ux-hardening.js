(()=>{
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const noteText=i=>String(i?.order_notes||i?.item_notes||i?.notes||'').trim();
  function addDot(el){if(!el||el.querySelector('.note-alert-dot'))return;const d=document.createElement('span');d.className='note-alert-dot';d.title='Pedido com observação';d.setAttribute('aria-label','Pedido com observação');el.appendChild(d)}
  function productTitle(p){const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();const out=[];for(const v0 of [p?.modelo||p?.sku,p?.variacao,p?.grade]){const v=String(v0||'').trim();if(!v)continue;const n=norm(v),joined=norm(out.join(' '));if(!n||joined.includes(n))continue;out.push(v)}return out.join(' · ')}
  function enhanceProductDetail(data,p){
    if(p){const title=$('#productDetailTitle');if(title)title.textContent=productTitle(p)||p.modelo||p.sku||'Produto';const sub=$('#productDetailSubtitle');if(sub)sub.textContent=[p.material,p.sku].filter(Boolean).join(' · ')}
    for(const item of data?.items||[]){if(!noteText(item))continue;const row=$(`#productBreakdown [data-breakdown-id="${item.order_item_id}"]`);const name=row?.querySelector('.breakdown-top>div:first-child>strong');addDot(name)}
  }
  function wrapProduct(){const old=window.renderProductDetail;if(typeof old!=='function'||old.__mobileUxWrapped)return;const fn=function(data,p){const r=old.apply(this,arguments);queueMicrotask(()=>enhanceProductDetail(data,p));return r};fn.__mobileUxWrapped=true;window.renderProductDetail=fn}
  function syncModalLock(){const on=!!$('.modal-backdrop.show');document.documentElement.classList.toggle('modal-open',on);document.body.classList.toggle('modal-open',on)}
  function cleanOrderRows(){for(const row of $$('.order-super-compact')){const block=row.querySelector(':scope>div:nth-child(2)');if(!block)continue;[...block.children].forEach(el=>{if(el.classList.contains('meta')&&!el.classList.contains('order-compact-meta'))el.style.display='none'})}}
  function scan(){syncModalLock();cleanOrderRows()}
  document.addEventListener('DOMContentLoaded',()=>{wrapProduct();scan();new MutationObserver(scan).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']})});
})();