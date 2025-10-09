// public/js/pedidos-reorganizar.js
(function(){
  const $ = (s, el=document)=>el.querySelector(s);
  const $$ = (s, el=document)=>Array.from(el.querySelectorAll(s));
  async function api(path, opts={}){
    const r = await fetch(path, { headers:{'content-type':'application/json'}, ...opts });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
  function ensurePages(){
    if (!$('#pedidos')){
      const d = document.createElement('section'); d.id='pedidos'; d.className='page hidden px-4 py-4';
      d.innerHTML = `
        <div class="max-w-6xl mx-auto">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-xl font-semibold">Pedidos</h2>
            <button id="btnNovoPedido" class="px-3 py-2 bg-indigo-600 text-white rounded">Lançar Novo Pedido</button>
          </div>
          <div id="pedidosList" class="border rounded divide-y"></div>
          <div id="pedidoForm" class="hidden mt-6 border rounded p-4">
            <h3 class="font-semibold mb-3">Novo Pedido</h3>
            <label class="block mb-2 text-sm">Cliente</label>
            <input id="pf-cliente" class="border rounded w-full px-3 py-2 mb-3" placeholder="Nome do cliente"/>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium">Filtros</label>
                <div class="mt-2 grid gap-2">
                  <input id="f-modelo" placeholder="Modelo" class="border rounded px-2 py-1"/>
                  <input id="f-grade" placeholder="Grade" class="border rounded px-2 py-1"/>
                  <input id="f-material" placeholder="Material" class="border rounded px-2 py-1"/>
                  <input id="f-variacao" placeholder="Variação" class="border rounded px-2 py-1"/>
                </div>
                <button id="btnAddFiltros" class="mt-3 px-3 py-2 bg-slate-200 rounded">Adicionar Itens ao Pedido →</button>
              </div>
              <div>
                <label class="block text-sm font-medium">Itens do Pedido</label>
                <div id="pf-itens" class="mt-2 border rounded divide-y"></div>
                <button id="btnSalvarPedido" class="mt-3 px-3 py-2 bg-green-600 text-white rounded">Salvar Pedido</button>
              </div>
            </div>
          </div>
          <div id="pedidoDetalhes" class="hidden mt-6"></div>
        </div>`;
      document.body.appendChild(d);
    }
    if (!$('#reorganizar')){
      const d = document.createElement('section'); d.id='reorganizar'; d.className='page hidden px-4 py-4';
      d.innerHTML = `
        <div class="max-w-5xl mx-auto">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-xl font-semibold">Reorganização Inteligente</h2>
            <div class="flex gap-2">
              <button id="btnPlan" class="px-3 py-2 bg-indigo-600 text-white rounded">Gerar Sugestões</button>
              <button id="btnScan" class="px-3 py-2 bg-slate-200 rounded">Validar por QR Code</button>
            </div>
          </div>
          <div id="reorgList" class="border rounded divide-y"></div>
        </div>`;
      document.body.appendChild(d);
    }
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
        // Para excluir, basta remover do índice e apagar a chave (implementar rota dedicada no backend se quiser)
        alert('Implemente uma rota DELETE em /api/orders para exclusão segura.');
      };
      wrap.appendChild(row);
    });
  }
  function newPedidoUI(){
    $('#pedidoForm').classList.remove('hidden');
    $('#pedidoDetalhes').classList.add('hidden');
    $('#pf-itens').innerHTML='';
    $('#pf-cliente').value='';
  }
  function addItensFromFiltros(){
    const modelo=$('#f-modelo').value.trim().toUpperCase();
    const grade=$('#f-grade').value.trim().toUpperCase();
    const material=$('#f-material').value.trim().toUpperCase();
    const variacao=$('#f-variacao').value.trim().toUpperCase();
    const key=[modelo,grade,material,variacao].filter(Boolean).join(' / ')||'ITEM';
    const cont=document.createElement('div');
    cont.className='p-2 flex items-center justify-between';
    cont.innerHTML=`
      <div>${key}</div>
      <div class="flex items-center gap-2">
        <input type="number" min="1" value="1" class="w-20 border rounded px-2 py-1 qty"/>
        <button class="rm px-2 py-1 text-red-700">Remover</button>
      </div>`;
    cont.querySelector('.rm').onclick=()=>cont.remove();
    $('#pf-itens').appendChild(cont);
  }
  async function salvarPedido(){
    const cliente=$('#pf-cliente').value.trim();
    const itens=$$('#pf-itens .p-2').map((el,idx)=>({
      productId: idx+1,
      quantidadePedida: Number($('.qty',el).value||0),
      quantidadeSeparada: 0
    })).filter(i=>i.quantidadePedida>0);
    if(!cliente||itens.length===0){ alert('Informe o cliente e ao menos 1 item.'); return; }
    await api('/api/orders',{ method:'POST', body: JSON.stringify({ cliente, itens }) });
    await loadPedidos();
    $('#pedidoForm').classList.add('hidden');
  }
  function openPedido(p){
    $('#pedidoForm').classList.add('hidden');
    const d=$('#pedidoDetalhes'); d.classList.remove('hidden');
    const faltantes=p.itens.filter(i=>i.quantidadeSeparada<i.quantidadePedida);
    d.innerHTML=`
      <div class="border rounded p-4">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="text-lg font-semibold">${p.referencia}</div>
            <div class="text-sm text-slate-600">${p.cliente}</div>
          </div>
          <div class="text-sm">Status: <span class="font-medium">${p.status}</span></div>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <h4 class="font-semibold mb-2">Lista de Separação</h4>
            <div id="sepList" class="space-y-2"></div>
            <button id="btnConfirmarSaidas" class="mt-3 px-3 py-2 bg-green-600 text-white rounded">Confirmar Saída</button>
          </div>
          <div>
            <h4 class="font-semibold mb-2">Lista de Produção</h4>
            <ul class="list-disc pl-5 text-sm" id="prodList"></ul>
          </div>
        </div>
      </div>`;
    const sepWrap=$('#sepList',d); const prodWrap=$('#prodList',d);
    faltantes.forEach(i=>{
      const pend=i.quantidadePedida - i.quantidadeSeparada;
      const el=document.createElement('div'); el.className='border rounded p-2';
      el.innerHTML=`
        <div class="text-sm mb-2">Produto #${i.productId} — pendente: <b>${pend}</b></div>
        <div class="flex items-center gap-2">
          <input placeholder="Local (ex: A-FRENTE)" class="border rounded px-2 py-1 w-40 loc"/>
          <input type="number" min="1" max="${pend}" value="${pend}" class="border rounded px-2 py-1 w-24 q"/>
        </div>`;
      sepWrap.appendChild(el);
      const li=document.createElement('li'); li.textContent=`Produto #${i.productId} — produzir: ${pend}`;
      prodWrap.appendChild(li);
    });
    $('#btnConfirmarSaidas').onclick=async()=>{
      const tasks=$$('#sepList > div',d).map(el=>({
        productId: Number(el.querySelector('.text-sm').textContent.match(/#(\d+)/)[1]),
        locations:[{ locationId: el.querySelector('.loc').value.trim(), qty: Number(el.querySelector('.q').value||0) }]
      }));
      await api(`/api/orders/${p.id}/confirmar`,{ method:'POST', body: JSON.stringify(tasks) });
      await loadPedidos(); d.classList.add('hidden');
    };
  }
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
  function init(){
    ensurePages();
    const top= document.querySelector('.topbar') || document.body;
    if (!$('#goPedidos', top)){
      const b=document.createElement('button'); b.id='goPedidos'; b.textContent='Pedidos';
      b.className='mx-2 px-2 py-1 border rounded';
      b.onclick=()=>{ $('#pedidos').classList.remove('hidden'); $('#reorganizar').classList.add('hidden'); loadPedidos(); };
      top.appendChild(b);
    }
    if (!$('#goReorg', top)){
      const b=document.createElement('button'); b.id='goReorg'; b.textContent='Reorganizar';
      b.className='mx-2 px-2 py-1 border rounded';
      b.onclick=()=>{ $('#reorganizar').classList.remove('hidden'); $('#pedidos').classList.add('hidden'); };
      top.appendChild(b);
    }
    $('#btnNovoPedido')?.addEventListener('click', newPedidoUI);
    $('#btnAddFiltros')?.addEventListener('click', addItensFromFiltros);
    $('#btnSalvarPedido')?.addEventListener('click', salvarPedido);
    $('#btnPlan')?.addEventListener('click', gerarSugestoes);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
