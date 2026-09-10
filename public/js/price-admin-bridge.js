(()=>{
  const TOKEN_KEY='estoque-admin-token';
  const state={prices:new Map(),draft:new Map(),loading:false,lastPath:''};
  const token=()=>sessionStorage.getItem(TOKEN_KEY)||localStorage.getItem(TOKEN_KEY)||'';
  const current=id=>state.draft.has(Number(id))?state.draft.get(Number(id)):(state.prices.has(Number(id))?state.prices.get(Number(id)):null);
  const original=id=>state.prices.has(Number(id))?state.prices.get(Number(id)):null;
  const dirty=id=>(current(id)===null?null:Number(current(id)))!==(original(id)===null?null:Number(original(id)));
  const authHeaders=()=>token()?{Authorization:`Bearer ${token()}`}:{ };
  const showMessage=(msg,error=false)=>{
    const el=document.createElement('div');
    el.className=`fixed bottom-5 right-5 z-[100] px-5 py-3 rounded-lg shadow-xl text-white ${error?'bg-red-600':'bg-green-600'}`;
    el.textContent=msg;document.body.appendChild(el);setTimeout(()=>el.remove(),3000);
  };
  async function loadPrices(force=false){
    if(state.loading)return;
    if(state.prices.size&&!force)return;
    state.loading=true;
    try{
      const r=await fetch('/api/precos',{headers:authHeaders(),cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||d.ok===false)throw new Error(d.error||`Erro ${r.status}`);
      state.prices=new Map((d.prices||[]).map(x=>[Number(x.product_id),x.base_price===null?null:Number(x.base_price)]));
    }catch(e){console.warn('[precos-legado]',e);}
    finally{state.loading=false}
  }
  function changedItems(){
    return [...state.draft.entries()].filter(([id])=>dirty(id)).map(([id,price])=>({product_id:id,base_price:price}));
  }
  async function saveDraft(){
    const items=changedItems();
    if(!items.length){showMessage('Nenhuma alteração de preço para salvar.');return}
    const btn=document.getElementById('legacy-price-save');
    try{
      if(btn){btn.disabled=true;btn.textContent='Salvando...'}
      const r=await fetch('/api/precos',{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({items}),cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||d.ok===false)throw new Error(d.error||`Erro ${r.status}`);
      items.forEach(i=>state.prices.set(i.product_id,i.base_price));state.draft.clear();
      showMessage(`${items.length} preço(s) salvo(s).`);enhanceProducts();
    }catch(e){showMessage(e.message||'Erro ao salvar preços.',true)}
    finally{if(btn){btn.disabled=false;btn.textContent='Salvar preços'}}
  }
  function ensureAdminLink(){
    const page=document.getElementById('page-admin');if(!page||page.classList.contains('hidden'))return;
    if(page.querySelector('[data-price-admin-link]'))return;
    const management=[...page.querySelectorAll('h2')].find(h=>h.textContent.trim()==='Gestão')?.parentElement;
    const buttons=management?.querySelector('.flex.flex-wrap.gap-3');
    if(!buttons)return;
    const a=document.createElement('a');
    a.href='/precos.html';a.dataset.priceAdminLink='1';
    a.className='bg-amber-500 text-white px-4 py-2 rounded-md hover:bg-amber-600 font-semibold flex items-center gap-2';
    a.innerHTML='<span style="font-weight:900">R$</span> Gerenciar preços';
    buttons.appendChild(a);
  }
  function setDraft(id,value){state.draft.set(Number(id),value===''?null:Number(value));updateToolbar()}
  function updateToolbar(){
    const items=changedItems();const save=document.getElementById('legacy-price-save');const count=document.getElementById('legacy-price-dirty-count');
    if(save)save.disabled=!items.length;if(count)count.textContent=items.length?`${items.length} alteração(ões) pendente(s)`:'Nenhuma alteração pendente';
  }
  async function enhanceProducts(){
    const page=document.getElementById('page-produtos');if(!page||page.classList.contains('hidden'))return;
    await loadPrices();
    const table=page.querySelector('table');if(!table)return;
    if(!page.querySelector('#legacy-price-toolbar')){
      const box=document.createElement('div');box.id='legacy-price-toolbar';
      box.className='mb-4 p-4 rounded-lg border border-amber-200 bg-amber-50';
      box.innerHTML=`<div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"><div><p class="font-bold text-amber-900">Preço-base dos SKUs</p><p class="text-xs text-amber-800">Use os mesmos checkboxes da tabela. O preço é uma referência e pode ser alterado em cada pedido.</p></div><a href="/precos.html" class="text-sm font-semibold text-amber-800 hover:underline">Abrir gerenciador completo →</a></div><div class="mt-3 flex flex-wrap items-center gap-2"><div class="flex items-center rounded-md border border-amber-300 bg-white overflow-hidden"><span class="px-3 text-sm text-gray-500">R$</span><input id="legacy-bulk-price" type="number" min="0" step="0.01" placeholder="0,00" class="w-32 px-2 py-2 outline-none"></div><button id="legacy-price-apply" class="px-3 py-2 rounded-md bg-amber-500 text-white font-semibold hover:bg-amber-600">Aplicar aos selecionados</button><button id="legacy-price-save" class="px-3 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50" disabled>Salvar preços</button><span id="legacy-price-dirty-count" class="text-xs text-amber-800">Nenhuma alteração pendente</span></div>`;
      table.closest('.bg-white')?.insertBefore(box,table.closest('.overflow-x-auto'));
      page.querySelector('#legacy-price-apply').onclick=()=>{
        const raw=page.querySelector('#legacy-bulk-price').value;if(raw===''){showMessage('Informe o preço.',true);return}
        const value=Number(raw);if(!Number.isFinite(value)||value<0){showMessage('Preço inválido.',true);return}
        const ids=[...page.querySelectorAll('.product-checkbox:checked')].map(c=>Number(c.dataset.productId));
        if(!ids.length){showMessage('Selecione pelo menos um produto.',true);return}
        ids.forEach(id=>state.draft.set(id,value));enhanceProducts();showMessage(`Preço aplicado a ${ids.length} produto(s). Clique em Salvar preços.`)
      };
      page.querySelector('#legacy-price-save').onclick=saveDraft;
    }
    const head=table.querySelector('thead tr');
    if(head&&!head.querySelector('[data-price-col]')){
      const th=document.createElement('th');th.dataset.priceCol='1';th.className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';th.textContent='Preço-base';head.appendChild(th);
    }
    [...table.querySelectorAll('tbody tr')].forEach(row=>{
      const check=row.querySelector('.product-checkbox');if(!check)return;const id=Number(check.dataset.productId);
      let td=row.querySelector('[data-price-cell]');
      if(!td){td=document.createElement('td');td.dataset.priceCell='1';td.className='px-6 py-3 whitespace-nowrap';row.appendChild(td)}
      const val=current(id);td.innerHTML=`<div class="flex items-center gap-2"><span class="text-xs text-gray-400">R$</span><input data-legacy-price-id="${id}" type="number" min="0" step="0.01" value="${val===null?'':Number(val).toFixed(2)}" placeholder="—" class="w-28 px-2 py-1.5 border rounded-md ${dirty(id)?'border-amber-500 ring-2 ring-amber-100':'border-gray-300'}"></div>`;
      td.querySelector('input').oninput=e=>{setDraft(id,e.target.value);e.target.classList.toggle('border-amber-500',dirty(id));e.target.classList.toggle('ring-2',dirty(id));e.target.classList.toggle('ring-amber-100',dirty(id))};
    });
    updateToolbar();
  }
  async function run(){ensureAdminLink();if(location.hash==='#produtos')enhanceProducts()}
  const observer=new MutationObserver(()=>{clearTimeout(observer.t);observer.t=setTimeout(run,80)});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('hashchange',()=>setTimeout(run,50));
  document.addEventListener('DOMContentLoaded',()=>setTimeout(run,100));
  run();
})();
