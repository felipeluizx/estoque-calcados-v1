// public/js/app-extensions.js
(function(){
  const $ = (s, el=document)=>el.querySelector(s);
  const $$ = (s, el=document)=>Array.from(el.querySelectorAll(s));
  async function api(path, opts={}){ const r=await fetch(path,{ headers:{'content-type':'application/json'}, ...opts}); if(!r.ok) throw new Error(await r.text()); return r.json(); }

  // --- Sidebar integration ---
  function insertMenu(){
    const sidebar = document.querySelector('.sidebar nav, .sidebar, aside, .menu, #sidebar');
    if(!sidebar) return;
    if (!sidebar.querySelector('a[href="#pedidos"]')){
      const a = document.createElement('a');
      a.href = "#pedidos";
      a.textContent = "Pedidos";
      a.className = "menu-link";
      sidebar.appendChild(a);
    }
    if (!sidebar.querySelector('a[href="#reorganizar"]')){
      const a = document.createElement('a');
      a.href = "#reorganizar";
      a.textContent = "Reorganizar";
      a.className = "menu-link";
      sidebar.appendChild(a);
    }
  }

  // --- Pages containers matching existing layout ---
  function ensurePages(){
    if (!$('#page-pedidos')){
      const c = document.createElement('section');
      c.id='page-pedidos';
      c.className='page hidden px-4 py-4';
      c.innerHTML = `
        <div class="max-w-7xl mx-auto">
          <h2 class="text-xl font-semibold mb-4">Pedidos</h2>
          <div class="mb-4 flex gap-2">
            <button id="btnNovoPedido" class="px-3 py-2 bg-indigo-600 text-white rounded">Lançar Novo Pedido</button>
            <button id="btnReloadPedidos" class="px-3 py-2 bg-slate-200 rounded">Atualizar Lista</button>
          </div>
          <div id="pedidosList" class="border rounded divide-y"></div>

          <div id="pedidoForm" class="hidden mt-6 border rounded p-4">
            <h3 class="font-semibold mb-3">Novo Pedido</h3>
            <label class="block mb-2 text-sm">Cliente</label>
            <input id="pf-cliente" class="border rounded w-full px-3 py-2 mb-4" placeholder="Nome do cliente"/>

            <div class="grid md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1">Modelo</label>
                <select id="f-modelo" multiple class="border rounded w-full p-2 h-40"></select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Grade</label>
                <select id="f-grade" multiple class="border rounded w-full p-2 h-40"></select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Material</label>
                <select id="f-material" multiple class="border rounded w-full p-2 h-40"></select>
                <label class="block text-sm font-medium mt-3 mb-1">Variação</label>
                <select id="f-variacao" multiple class="border rounded w-full p-2 h-40"></select>
              </div>
            </div>

            <div class="mt-3 flex justify-between">
              <button id="btnAddFiltros" class="px-3 py-2 bg-slate-200 rounded">Adicionar Itens ao Pedido →</button>
              <button id="btnSalvarPedido" class="px-3 py-2 bg-green-600 text-white rounded">Salvar Pedido</button>
            </div>

            <div class="mt-4">
              <label class="block text-sm font-medium mb-1">Itens do Pedido</label>
              <div id="pf-itens" class="border rounded divide-y"></div>
            </div>
          </div>

          <div id="pedidoDetalhes" class="hidden mt-6"></div>
        </div>`;
      document.querySelector('main')?.appendChild(c) || document.body.appendChild(c);
    }
    if (!$('#page-reorganizar')){
      const c = document.createElement('section');
      c.id='page-reorganizar';
      c.className='page hidden px-4 py-4';
      c.innerHTML = `
        <div class="max-w-7xl mx-auto">
          <h2 class="text-xl font-semibold mb-4">Reorganização Inteligente</h2>
          <div class="mb-4 flex gap-2">
            <button id="btnPlan" class="px-3 py-2 bg-indigo-600 text-white rounded">Gerar Sugestões</button>
            <button id="btnScan" class="px-3 py-2 bg-slate-200 rounded">Validar por QR Code</button>
          </div>
          <div id="reorgList" class="border rounded divide-y"></div>
        </div>`;
      document.querySelector('main')?.appendChild(c) || document.body.appendChild(c);
    }
  }

  // --- Router: show by hash ---
  function showPage(name){
    $$('.page').forEach(p=>p.classList.add('hidden'));
    if (name === 'pedidos') $('#page-pedidos')?.classList.remove('hidden');
    if (name === 'reorganizar') $('#page-reorganizar')?.classList.remove('hidden');
  }
  window.addEventListener('hashchange', ()=> {
    const h = location.hash.replace('#','');
    if (h === 'pedidos' || h==='reorganizar') showPage(h);
  });

  // --- Pedidos ---
  async function loadFacets(){
    const res = await api('/api/products?facets=1');
    const setOpts = (sel, arr)=> {
      const el = $(sel); if(!el) return;
      el.innerHTML = arr.map(v=>`<option value="${v}">${v}</option>`).join('');
    };
    setOpts('#f-modelo', res.facets.modelo||[]);
    setOpts('#f-grade', res.facets.grade||[]);
    setOpts('#f-material', res.facets.material||[]);
    setOpts('#f-variacao', res.facets.variacao||[]);
  }
  function selectedMulti(sel){
    return Array.from($(sel).selectedOptions || []).map(o=>o.value);
  }
  function appendPedidoItem(key, qty=1){
    const cont=document.createElement('div'); cont.className='p-2 flex items-center justify-between';
    cont.innerHTML = `
      <div>${key}</div>
      <div class="flex items-center gap-2">
        <input type="number" min="1" value="${qty}" class="w-20 border rounded px-2 py-1 qty"/>
        <button class="rm px-2 py-1 text-red-700">Remover</button>
      </div>`;
    cont.querySelector('.rm').onclick=()=>cont.remove();
    $('#pf-itens').appendChild(cont);
  }
  async function addFromFilters(){
    const modelo = selectedMulti('#f-modelo');
    const grade = selectedMulti('#f-grade');
    const material = selectedMulti('#f-material');
    const variacao = selectedMulti('#f-variacao');
    const key = [modelo.join(','), grade.join(','), material.join(','), variacao.join(',')].filter(Boolean).join(' / ') || 'ITEM';
    appendPedidoItem(key, 1);
  }

  async function loadPedidos(){
    const data = await api('/api/orders');
    const wrap = $('#pedidosList'); wrap.innerHTML='';
    (data.orders||[]).forEach(p=>{
      const row=document.createElement('div');
      row.className='p-3 flex items-center justify-between';
      row.innerHTML=`
        <div>
          <div class="font-medium">${p.referencia}</div>
          <div class="text-sm text-slate-600">${p.cliente} — ${new Date(p.data).toLocaleString()}</div>
          <div class="text-xs text-slate-500">Status: ${p.status}</div>
        </div>
        <div class="flex gap-2">
          <button class="view px-2 py-1 text-indigo-700">Ver</button>
          <button class="del px-2 py-1 text-red-700">Excluir</button>
        </div>`;
      row.querySelector('.view').onclick=()=>openPedido(p);
      row.querySelector('.del').onclick=async()=>{
        if(!confirm('Excluir este pedido?')) return;
        await fetch(`/api/orders/${p.id}`, { method:'DELETE' });
        await loadPedidos();
      };
      wrap.appendChild(row);
    });
  }

  async function salvarPedido(){
    const cliente=$('#pf-cliente').value.trim();
    if(!cliente){ alert('Informe o cliente'); return; }
    // No catálogo real, aqui convertemos os filtros em productIds; por ora criamos um item fake por linha.
    const itens=$$('#pf-itens .p-2').map((el,idx)=>({
      productId: idx+1,
      quantidadePedida: Number($('.qty',el).value||0),
      quantidadeSeparada: 0
    })).filter(i=>i.quantidadePedida>0);
    if(itens.length===0){ alert('Adicione itens ao pedido'); return; }
    await api('/api/orders',{ method:'POST', body: JSON.stringify({ cliente, itens }) });
    $('#pedidoForm').classList.add('hidden');
    await loadPedidos();
  }

  async function openPedido(p){
    $('#pedidoForm').classList.add('hidden');
    const d=$('#pedidoDetalhes'); d.classList.remove('hidden');
    d.innerHTML = `
      <div class="border rounded p-4">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="text-lg font-semibold">${p.referencia}</div>
            <div class="text-sm text-slate-600">${p.cliente}</div>
          </div>
          <div class="text-sm">Status: <span class="font-medium">${p.status}</span></div>
        </div>
        <div class="mb-3">
          <button id="btnGerarPick" class="px-3 py-2 bg-slate-200 rounded">Gerar Lista de Separação</button>
          <button id="btnConfirmarSaidas" class="px-3 py-2 bg-green-600 text-white rounded">Confirmar Saída</button>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <h4 class="font-semibold mb-2">Lista de Separação</h4>
            <div id="sepList" class="space-y-2"></div>
          </div>
          <div>
            <h4 class="font-semibold mb-2">Lista de Produção</h4>
            <ul class="list-disc pl-5 text-sm" id="prodList"></ul>
          </div>
        </div>
      </div>`;

    const sepWrap = $('#sepList', d);
    const prodWrap = $('#prodList', d);

    // Build production list based on pending qty
    (p.itens||[]).forEach(i=>{
      const pend = Math.max(0, Number(i.quantidadePedida) - Number(i.quantidadeSeparada||0));
      if (pend>0){
        const li=document.createElement('li');
        li.textContent=`Produto #${i.productId} — produzir: ${pend}`;
        prodWrap.appendChild(li);
      }
    });

    $('#btnGerarPick').onclick = async ()=>{
      const plan = await api(`/api/orders/${p.id}/pickplan`);
      sepWrap.innerHTML='';
      (plan.plan||[]).forEach(it=>{
        const pend = it.need;
        const el = document.createElement('div'); el.className='border rounded p-2';
        const rows = (it.plan||[]).map(s=>`
          <div class="flex items-center gap-2 mb-1">
            <input value="${s.locationId}" class="border rounded px-2 py-1 w-40 loc"/>
            <input type="number" min="0" max="${s.qty}" value="${Math.min(s.qty, pend)}" class="border rounded px-2 py-1 w-24 q"/>
          </div>`).join('');
        el.innerHTML = `
          <div class="text-sm mb-2">Produto #${it.productId} — pendente: <b>${pend}</b></div>
          ${rows || '<div class="text-xs text-slate-500">Sem estoque para este item.</div>'}`;
        sepWrap.appendChild(el);
      });
    };

    $('#btnConfirmarSaidas').onclick = async ()=>{
      const tasks = $$('#sepList > div', d).map(el => ({
        productId: Number(el.querySelector('.text-sm').textContent.match(/#(\d+)/)[1]),
        locations: $$('.flex', el).map(row => ({
          locationId: $('.loc', row)?.value?.trim() || '',
          qty: Number($('.q', row)?.value || 0)
        })).filter(x=>x.locationId && x.qty>0)
      })).filter(t=>t.locations.length>0);
      if (tasks.length===0){ alert('Nada para confirmar'); return; }
      await api(`/api/orders/${p.id}/confirmar`, { method:'POST', body: JSON.stringify(tasks) });
      location.reload();
    };
  }

  // --- Reorganizar ---
  async function gerarSugestoes(){
    const data=await api('/api/reorganizar/plan',{ method:'POST', body: JSON.stringify({}) });
    const wrap=$('#reorgList'); wrap.innerHTML='';
    (data.moves||[]).forEach(mv=>{
      const row=document.createElement('div'); row.className='p-3 flex items-center justify-between';
      row.innerHTML=`
        <div class="text-sm">
          <div class="font-medium">${mv.rule}</div>
          <div>Produto #${mv.productId}: ${mv.from} → ${mv.to} — <b>${mv.qty}</b></div>
        </div>
        <button class="apply px-2 py-1 bg-green-600 text-white rounded">Confirmar</button>`;
      row.querySelector('.apply').onclick=async()=>{
        await api('/api/reorganizar/apply',{ method:'POST', body: JSON.stringify({ productId: mv.productId, from: mv.from, to: mv.to, qty: mv.qty }) });
        row.classList.add('bg-green-50'); row.querySelector('.apply').disabled=true;
      };
      wrap.appendChild(row);
    });
  }

  // Event delegation for dynamically present buttons
  document.addEventListener('click', (e)=>{
    const t = e.target;
    if (t?.id === 'btnPlan'){ gerarSugestoes().catch(err=>alert('Erro ao gerar sugestões: '+err.message)); }
    if (t?.id === 'btnNovoPedido'){ $('#pedidoForm')?.classList.remove('hidden'); loadFacets(); }
    if (t?.id === 'btnAddFiltros'){ addFromFilters(); }
    if (t?.id === 'btnSalvarPedido'){ salvarPedido().catch(err=>alert('Erro ao salvar: '+err.message)); }
    if (t?.id === 'btnReloadPedidos'){ loadPedidos(); }
  });

  function init(){
    insertMenu();
    ensurePages();
    // default page if hash present
    const h = location.hash.replace('#','');
    if (h==='pedidos' || h==='reorganizar') showPage(h);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
