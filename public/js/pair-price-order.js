(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  let defaultUnits=12;
  const n=v=>Number(v);
  const valid=v=>Number.isFinite(Number(v));
  const fmt=v=>valid(v)?Number(v).toFixed(2):'';

  async function loadDefaultUnits(){
    try{
      const d=await api('/api/configuracoes');
      defaultUnits=Math.max(1,Number(d.settings?.grade_size)||12);
    }catch{}
  }

  function lineUnits(line){
    const special=line.querySelector('.special-grade-check')?.checked;
    const custom=n(line.querySelector('.special-grade-units')?.value);
    return special&&custom>0?Math.floor(custom):defaultUnits;
  }

  function ensurePairField(line){
    if(!line||line.querySelector('.item-pair-price'))return;
    const finalWrap=line.querySelector('.price-final');
    const discWrap=line.querySelector('.price-discount');
    const baseWrap=line.querySelector('.price-base');
    if(!finalWrap)return;

    const wrap=document.createElement('div');
    wrap.className='mini-field price-pair';
    wrap.innerHTML='<label>Preço/par</label><input class="item-pair-price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="—">';
    (discWrap||finalWrap).before(wrap);

    const pair=wrap.querySelector('.item-pair-price');
    const base=line.querySelector('.item-base');
    const final=line.querySelector('.item-final');
    const disc=line.querySelector('.item-discount');
    if(baseWrap?.querySelector('label'))baseWrap.querySelector('label').textContent='Base caixa';
    if(finalWrap?.querySelector('label'))finalWrap.querySelector('label').textContent='Valor caixa';

    const syncFromProduct=()=>{
      const sel=line.querySelector('.item-product');
      const p=(state.products||[]).find(x=>Number(x.id)===Number(sel?.value));
      const unit=p?priceByProduct(p.id):null;
      if(unit!==null&&unit!==undefined&&!pair.dataset.userEdited){
        pair.value=fmt(unit);
        syncBoxFromPair();
      }else if(final?.value&&!pair.value){
        const units=lineUnits(line);if(units>0)pair.value=fmt(n(final.value)/units);
      }
    };

    const syncBoxFromPair=()=>{
      if(!valid(pair.value)||pair.value==='')return;
      const units=lineUnits(line);
      const box=n(pair.value)*units;
      if(final){final.value=fmt(box);final.dataset.userEdited='1';final.dispatchEvent(new Event('input',{bubbles:true}));}
      if(base&&valid(base.value)&&n(base.value)>0&&disc)disc.value=Math.max(0,(1-box/n(base.value))*100).toFixed(2);
      if(typeof updateNewOrderTotal==='function')updateNewOrderTotal();
    };

    pair.addEventListener('input',()=>{pair.dataset.userEdited='1';syncBoxFromPair()});
    final?.addEventListener('input',()=>{
      if(document.activeElement===pair)return;
      const units=lineUnits(line);if(units>0&&valid(final.value))pair.value=fmt(n(final.value)/units);
    });
    line.querySelector('.special-grade-check')?.addEventListener('change',()=>setTimeout(syncBoxFromPair,0));
    line.querySelector('.special-grade-units')?.addEventListener('input',syncBoxFromPair);
    line.querySelector('.item-product')?.addEventListener('change',()=>setTimeout(syncFromProduct,0));
    line.querySelector('.item-sku-input')?.addEventListener('change',()=>setTimeout(syncFromProduct,0));
    setTimeout(syncFromProduct,0);
  }

  function enhanceNewOrder(){
    $$('#orderItems .order-item-line').forEach(ensurePairField);
  }

  function addDetailPairField(d){
    const i=d?.item;if(!i)return;
    const form=$('#itemFinal')?.closest('.detail-form');
    if(!form||$('#itemPairPrice'))return;
    const units=Math.max(1,Number(i.units_per_box)||defaultUnits||12);
    const final=$('#itemFinal'),base=$('#itemBase'),disc=$('#itemDiscount');
    const wrap=document.createElement('div');
    wrap.className='detail-field pair-price-detail';
    wrap.innerHTML=`<label>Preço por par</label><input id="itemPairPrice" type="number" min="0" step="0.01" inputmode="decimal" value="${fmt(n(i.unit_price||0)/units)}"><small>${units} pares nesta grade</small>`;
    final?.closest('.detail-field')?.before(wrap);
    const pair=$('#itemPairPrice');
    const baseLabel=base?.closest('.detail-field')?.querySelector('label');if(baseLabel)baseLabel.textContent='Base da caixa';
    const finalLabel=final?.closest('.detail-field')?.querySelector('label');if(finalLabel)finalLabel.textContent='Valor da caixa';
    pair.oninput=()=>{
      const box=n(pair.value)*units;
      final.value=fmt(box);
      final.dispatchEvent(new Event('input',{bubbles:true}));
      if(base&&n(base.value)>0&&disc)disc.value=Math.max(0,(1-box/n(base.value))*100).toFixed(2);
    };
    final?.addEventListener('input',()=>{if(document.activeElement!==pair&&valid(final.value))pair.value=fmt(n(final.value)/units)});
  }

  function addBreakdownPairFields(data){
    for(const i of data?.items||[]){
      const row=$(`#productBreakdown [data-breakdown-id="${i.order_item_id}"]`);if(!row||row.querySelector('.bd-pair'))continue;
      const edit=row.querySelector('.breakdown-edit'),final=row.querySelector('.bd-final');if(!edit||!final)continue;
      const units=Math.max(1,Number(i.units_per_box)||defaultUnits||12);
      const field=document.createElement('div');field.className='mini-field';field.innerHTML=`<label>Preço/par</label><input class="bd-pair" type="number" min="0" step="0.01" inputmode="decimal" value="${fmt(n(i.unit_price||0)/units)}">`;
      final.closest('.mini-field')?.before(field);
      const pair=field.querySelector('.bd-pair');
      const finalLabel=final.closest('.mini-field')?.querySelector('label');if(finalLabel)finalLabel.textContent='Valor caixa';
      const baseLabel=row.querySelector('.bd-base')?.closest('.mini-field')?.querySelector('label');if(baseLabel)baseLabel.textContent='Base caixa';
      pair.oninput=()=>{final.value=fmt(n(pair.value)*units);final.dispatchEvent(new Event('input',{bubbles:true}))};
      final.addEventListener('input',()=>{if(document.activeElement!==pair&&valid(final.value))pair.value=fmt(n(final.value)/units)});
    }
  }

  function wrap(name,after){
    const old=window[name];if(typeof old!=='function'||old.__pairPriceWrapped)return;
    const fn=function(...args){const r=old.apply(this,args);queueMicrotask(()=>after(...args));return r};
    fn.__pairPriceWrapped=true;window[name]=fn;
  }

  function visibleHeight(){return window.visualViewport?.height||window.innerHeight}
  function placeSkuSuggestions(input){
    const host=input?.closest('.sku-live-host'),box=host?.querySelector('.sku-live-results');if(!host||!box)return;
    const vh=visibleHeight(),rect=input.getBoundingClientRect(),below=vh-rect.bottom,above=rect.top,max=Math.max(120,Math.min(280,(below>=above?below:above)-18));
    box.classList.toggle('open-up',below<190&&above>below);
    box.style.maxHeight=`${max}px`;
  }
  function revealSkuInput(input){
    setTimeout(()=>{input.scrollIntoView({block:'center',behavior:'smooth'});setTimeout(()=>placeSkuSuggestions(input),180)},120);
  }

  function installKeyboardFix(){
    document.addEventListener('focusin',e=>{if(e.target.matches('.item-sku-input'))revealSkuInput(e.target)});
    document.addEventListener('input',e=>{if(e.target.matches('.item-sku-input'))placeSkuSuggestions(e.target)});
    window.visualViewport?.addEventListener('resize',()=>{const input=document.activeElement;if(input?.matches?.('.item-sku-input')){revealSkuInput(input);placeSkuSuggestions(input)}});
  }

  document.addEventListener('DOMContentLoaded',async()=>{
    await loadDefaultUnits();
    enhanceNewOrder();
    wrap('renderItemDetail',addDetailPairField);
    wrap('renderProductDetail',addBreakdownPairFields);
    installKeyboardFix();
    const root=$('#orderItems');if(root)new MutationObserver(enhanceNewOrder).observe(root,{childList:true});
    document.addEventListener('click',e=>{if(e.target.closest('#newOrderBtn,#newOrderBtn2,#addOrderItemBtn'))setTimeout(enhanceNewOrder,20)},true);
  });
})();
