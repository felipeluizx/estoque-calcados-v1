
(function(){
  function ensureMenu(){
    const nav = document.querySelector('nav, .sidebar, .menu, #sidebar') || document.body;
    if (!document.querySelector("a.menu-item[href='#pedidos']")) {
      const a = document.createElement('a');
      a.href = '#pedidos'; a.textContent = 'Pedidos';
      a.className = 'menu-item px-3 py-2 rounded-md';
      nav.appendChild(a);
    }
    if (!document.querySelector("a.menu-item[href='#organizacao']")) {
      const a = document.createElement('a');
      a.href = '#organizacao'; a.textContent = 'Organização';
      a.className = 'menu-item px-3 py-2 rounded-md';
      nav.appendChild(a);
    }
  }
  function ensurePages(){
    const main = document.querySelector('main') || document.body;
    if (!document.getElementById('page-pedidos')) {
      const d = document.createElement('div');
      d.id='page-pedidos'; d.className='page hidden'; main.appendChild(d);
    }
    if (!document.getElementById('page-organizacao')) {
      const d = document.createElement('div');
      d.id='page-organizacao'; d.className='page hidden'; main.appendChild(d);
    }
  }
  function showPage(hash){
    const id = (hash||'#home').replace('#','');
    const pageId = 'page-'+(id||'home');
    document.querySelectorAll('.page').forEach(el=>el.classList.add('hidden'));
    const el = document.getElementById(pageId); if (el) el.classList.remove('hidden');
    if (id==='pedidos') renderPedidos();
    if (id==='organizacao') renderOrganizacao();
  }
  window.addEventListener('hashchange', ()=>showPage(location.hash));
  window.addEventListener('DOMContentLoaded', ()=>{ ensureMenu(); ensurePages(); showPage(location.hash||'#home'); });

  window.renderPedidos = async function(){
    const el = document.getElementById('page-pedidos');
    if(!el) return;
    el.innerHTML = `
      <div class="bg-white shadow rounded-xl p-4 md:p-6 mb-6">
        <h2 class="text-xl font-semibold mb-3">Novo pedido</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input id="od_customer" class="border rounded px-3 py-2" placeholder="Cliente (opcional)">
          <input id="od_notes" class="border rounded px-3 py-2 md:col-span-2" placeholder="Observações (opcional)">
        </div>
        <div class="mt-4">
          <label class="text-sm text-gray-600">Itens (um por linha):</label>
          <textarea id="od_lines" class="mt-1 w-full border rounded px-3 py-2" rows="6"
            placeholder="Exemplos:\nCAMPUS CAMURCA PRETO ALTA = 2\nCAMPUS SINTETICO BRANCO INFANTIL = 1\n#182 = 3"></textarea>
        </div>
        <div class="flex flex-wrap gap-2 mt-3">
          <label class="flex items-center gap-2 text-sm"><input id="od_mode_immediate" type="checkbox"> Baixar no scan</label>
          <button id="od_create" class="px-4 py-2 bg-blue-700 text-white rounded-lg">Criar pedido</button>
          <span id="od_msg" class="text-sm text-gray-600"></span>
        </div>
      </div>

      <div id="od_after" class="hidden bg-white shadow rounded-xl p-4 md:p-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold">Pick list</h3>
          <div class="flex gap-2">
            <button id="od_allocate" class="px-3 py-1 bg-gray-900 text-white rounded">Gerar plano</button>
            <button id="od_print" class="px-3 py-1 bg-gray-700 text-white rounded">Imprimir</button>
          </div>
        </div>
        <table class="w-full text-sm">
          <thead><tr class="text-left border-b">
            <th class="py-2 pr-3">Posição</th><th class="py-2 pr-3">Produto</th><th class="py-2 pr-3">Qtd</th>
          </tr></thead>
          <tbody id="od_steps"></tbody>
        </table>
        <div class="mt-4">
          <h4 class="font-medium">Faltou</h4>
          <ul id="od_missing" class="list-disc pl-6 text-sm"></ul>
        </div>

        <div class="flex gap-2 mt-4">
          <button id="od_start" class="px-4 py-2 bg-green-700 text-white rounded-lg">Iniciar separação</button>
          <button id="od_finish" class="px-4 py-2 bg-purple-700 text-white rounded-lg">Finalizar</button>
          <span id="od_status" class="text-sm text-gray-600"></span>
        </div>
      </div>
    `;

    let orderId = null;

    document.getElementById('od_create').onclick = async () => {
      const lines = document.getElementById('od_lines').value.split(/\n+/).map(s=>s.trim()).filter(Boolean);
      const items = [];
      for (const ln of lines) {
        const mId = ln.match(/^#?(\d+)\s*=\s*(\d+)/);
        if (mId) { items.push({ productId: Number(mId[1]), requested: Number(mId[2]) }); continue; }
        const m = ln.match(/^(.*?)[=:]\s*(\d+)/) || ln.match(/^(.*)\s+\=\s+(\d+)$/);
        if (m) { items.push({ query: m[1].trim(), requested: Number(m[2]) }); continue; }
        const m2 = ln.match(/^(.*?)\s+(\d+)$/);
        if (m2) { items.push({ query: m2[1].trim(), requested: Number(m2[2]) }); continue; }
      }
      const res = await fetch('/api/orders', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ items, customer: document.getElementById('od_customer').value||null, notes: document.getElementById('od_notes').value||null }) });
      const j = await res.json();
      if (!j.ok) return document.getElementById('od_msg').textContent = j.error||'Erro ao criar';
      orderId = j.order.id;
      document.getElementById('od_msg').textContent = `Pedido #${orderId} criado.`;
      document.getElementById('od_after').classList.remove('hidden');
    };

    async function loadPickList(){
      const r = await fetch(`/api/orders/${orderId}/picklist`);
      const j = await r.json();
      const tb = document.getElementById('od_steps'); tb.innerHTML='';
      (j.steps||[]).forEach(s => {
        const tr = document.createElement('tr'); tr.className='border-b';
        tr.innerHTML = `<td class="py-2 pr-3">${s.locationId}</td><td class="py-2 pr-3">${s.name}</td><td class="py-2 pr-3">${s.qty}</td>`;
        tb.appendChild(tr);
      });
      const ul = document.getElementById('od_missing'); ul.innerHTML='';
      (j.missing||[]).forEach(m => {
        const li = document.createElement('li'); li.textContent = `${m.name}: faltam ${m.missing}`; ul.appendChild(li);
      });
    }

    document.getElementById('od_allocate').onclick = async () => {
      if (!orderId) return;
      await fetch(`/api/orders/${orderId}/allocate`, { method:'POST' });
      await loadPickList();
    };
    document.getElementById('od_print').onclick = () => window.print();
    document.getElementById('od_start').onclick = async () => {
      if (!orderId) return;
      await fetch(`/api/orders/${orderId}/start`, { method:'POST' });
      document.getElementById('od_status').textContent = 'Picking iniciado.';
    };
    document.getElementById('od_finish').onclick = async () => {
      if (!orderId) return;
      await fetch(`/api/orders/${orderId}/finish`, { method:'POST' });
      document.getElementById('od_status').textContent = 'Pedido finalizado e baixado do estoque.';
      await loadPickList();
    };
  };

  window.renderOrganizacao = async function(){
    const el = document.getElementById('page-organizacao');
    if(!el) return;
    el.innerHTML = `
      <div class="bg-white shadow rounded-xl p-4 md:p-6">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-xl font-semibold">Otimizar layout por slot</h2>
          <div class="flex gap-2">
            <input id="rg_max" type="number" class="border rounded px-2 py-1 w-28" value="100" title="Máx. movimentos">
            <button id="rg_plan" class="px-3 py-1 bg-gray-900 text-white rounded">Gerar plano</button>
          </div>
        </div>
        <table class="w-full text-sm">
          <thead><tr class="text-left border-b">
            <th class="py-2 pr-3">Produto</th><th class="py-2 pr-3">De</th><th class="py-2 pr-3">Para</th><th class="py-2 pr-3">Qtd</th><th class="py-2 pr-3">QR</th>
          </tr></thead>
          <tbody id="rg_rows"></tbody>
        </table>
        <p class="text-sm mt-3">Para aplicar: leia o QR de cada linha após movimentar fisicamente. Cada leitura chama <code>/api/reorg/scan</code> e atualiza o estoque.</p>
      </div>
    `;
    const rows = document.getElementById('rg_rows');
    document.getElementById('rg_plan').onclick = async () => {
      const maxMoves = Number(document.getElementById('rg_max').value||100);
      const r = await fetch('/api/reorg/plan', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ maxMoves }) });
      const j = await r.json();
      rows.innerHTML = '';
      (j.plan?.moves||[]).forEach(m => {
        const tr = document.createElement('tr'); tr.className='border-b';
        tr.innerHTML = `<td class="py-2 pr-3">#${m.productId}</td><td class="py-2 pr-3">${m.from}</td><td class="py-2 pr-3">${m.to}</td><td class="py-2 pr-3">${m.qty}</td><td class="py-2 pr-3"><div id="qr-${m.id}"></div></td>`;
        rows.appendChild(tr);
        const payload = JSON.stringify({ type:'reorg-move', moveId:m.id, productId:m.productId, from:m.from, to:m.to, qty:m.qty });
        if (!window.QRCode) {
          const s = document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
          document.head.appendChild(s); s.onload=()=> new QRCode(document.getElementById('qr-'+m.id), { text: payload, width: 96, height: 96 });
        } else {
          new QRCode(document.getElementById('qr-'+m.id), { text: payload, width: 96, height: 96 });
        }
      });
    };
  };
})();
