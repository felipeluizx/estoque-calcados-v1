<script>
(function () {
  // ===== Helpers para achar/duplicar itens de menu =====
  function findSidebarRoot() {
    // tenta pegar o contêiner do menu onde já estão "Dashboard/Entrada/Saída/Mapa..."
    const candidates = [
      '#sidebar', '.sidebar', '[data-role="sidebar"]',
      'aside', 'nav', '.menu', '.left-nav'
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (!el) continue;
      // precisa ter links dentro
      if (el.querySelector('a[href^="#"]')) return el;
    }
    return null;
  }

  function findReferenceLink(root) {
    if (!root) return null;
    // tenta achar um item que sabemos que existe
    const prefs = [
      'a[href="#dashboard"]', 'a[href="#entrada"]', 'a[href="#saida"]',
      'a[href="#mapa"]', 'a[href="#mapa-do-estoque"]',
      'a:contains("Mapa")', 'a:contains("Entrada")'
    ];
    // :contains não é CSS; implementamos:
    for (const sel of prefs) {
      if (sel.includes(':contains')) continue;
      const a = root.querySelector(sel);
      if (a) return a;
    }
    // Fallback: primeiro link do root
    return root.querySelector('a[href^="#"]');
  }

  function createMenuItemLike(refLink, label, hash) {
    if (!refLink) {
      // Fallback simples: cria um <a> básico
      const a = document.createElement('a');
      a.href = hash; a.textContent = label;
      a.className = 'menu-item px-3 py-2 rounded-md block';
      return a;
    }
    const li = refLink.closest('li');
    if (li && li.parentElement && (li.parentElement.tagName === 'UL' || li.parentElement.tagName === 'OL')) {
      const newLi = li.cloneNode(true);
      const a = newLi.querySelector('a') || newLi;
      a.href = hash;
      a.textContent = label;
      // remove estados ativos do clone
      a.classList.remove('active', 'bg-gray-900', 'text-white');
      return newLi;
    } else {
      // Estrutura não é <li>, copia apenas o <a>
      const newA = refLink.cloneNode(true);
      newA.href = hash;
      newA.textContent = label;
      newA.classList.remove('active', 'bg-gray-900', 'text-white');
      return newA;
    }
  }

  function appendMenu(root, refLink, label, hash) {
    const node = createMenuItemLike(refLink, label, hash);
    if (refLink && refLink.closest('li') && refLink.closest('ul,ol')) {
      refLink.closest('ul,ol').appendChild(node);
    } else {
      root.appendChild(node);
    }
  }

  // ===== Páginas =====
  function ensurePages() {
    const main = document.querySelector('main') || document.body;
    const mk = (id) => {
      if (!document.getElementById(id)) {
        const d = document.createElement('div');
        d.id = id; d.className = 'page hidden';
        main.appendChild(d);
      }
    };
    mk('page-pedidos');
    mk('page-organizacao');
  }

  function showPageFromHash() {
    const id = (location.hash || '#home').replace('#', '');
    document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
    const el = document.getElementById('page-' + (id || 'home'));
    if (el) el.classList.remove('hidden');
    if (id === 'pedidos') renderPedidos();
    if (id === 'organizacao') renderOrganizacao();
  }

  // ===== Render Pedidos (modo simples + por filtros) =====
  async function renderPedidos() {
    const box = document.getElementById('page-pedidos');
    if (!box) return;
    // Já montado? Evita recriar em cada hashchange
    if (box.dataset.ready === '1') return;
    box.dataset.ready = '1';

    box.innerHTML = `
      <div class="bg-white shadow rounded-xl p-4 md:p-6">
        <div class="flex items-center gap-3 mb-4">
          <button id="tab-simples" class="px-3 py-1 rounded bg-gray-900 text-white">Simples</button>
          <button id="tab-filtros" class="px-3 py-1 rounded border">Por filtros</button>
        </div>

        <div id="box-simples">
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

        <div id="box-filtros" class="hidden">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div><div class="text-sm text-gray-600 mb-1">Modelo</div><div id="f_modelo" class="flex flex-wrap"></div></div>
            <div><div class="text-sm text-gray-600 mb-1">Grade</div><div id="f_grade" class="flex flex-wrap"></div></div>
            <div><div class="text-sm text-gray-600 mb-1">Material</div><div id="f_material" class="flex flex-wrap"></div></div>
            <div><div class="text-sm text-gray-600 mb-1">Variação/Cor</div><div id="f_variacao" class="flex flex-wrap"></div></div>
          </div>
          <div class="flex gap-2 mt-3">
            <button id="f_gerar" class="px-3 py-1 bg-gray-900 text-white rounded">Gerar variações</button>
            <button id="f_limpar" class="px-3 py-1 border rounded">Limpar</button>
          </div>
          <div class="mt-4">
            <table class="w-full text-sm">
              <thead><tr class="text-left border-b">
                <th class="py-2 pr-3">Produto</th><th class="py-2 pr-3 w-24">Qtd</th><th class="py-2 pr-3">Remover</th>
              </tr></thead>
              <tbody id="f_rows"></tbody>
            </table>
          </div>
          <div class="flex gap-2 mt-3">
            <button id="f_criar" class="px-4 py-2 bg-blue-700 text-white rounded-lg">Criar pedido</button>
            <span id="f_msg" class="text-sm text-gray-600"></span>
          </div>
        </div>

        <div id="od_after" class="hidden mt-6">
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
      </div>
    `;

    // Tabs
    const tabSimples = document.getElementById('tab-simples');
    const tabFiltros = document.getElementById('tab-filtros');
    const boxSimples = document.getElementById('box-simples');
    const boxFiltros = document.getElementById('box-filtros');
    tabSimples.onclick = () => { tabSimples.classList.add('bg-gray-900','text-white'); tabFiltros.classList.remove('bg-gray-900','text-white'); boxSimples.classList.remove('hidden'); boxFiltros.classList.add('hidden'); };
    tabFiltros.onclick = () => { tabFiltros.classList.add('bg-gray-900','text-white'); tabSimples.classList.remove('bg-gray-900','text-white'); boxFiltros.classList.remove('hidden'); boxSimples.classList.add('hidden'); };

    // Modo simples
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

    async function loadPickList() {
      const r = await fetch(`/api/orders/${orderId}/picklist`);
      const j = await r.json();
      const tb = document.getElementById('od_steps'); tb.innerHTML = '';
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
    document.getElementById('od_allocate').onclick = async () => { if (!orderId) return; await fetch(`/api/orders/${orderId}/allocate`,{method:'POST'}); await loadPickList(); };
    document.getElementById('od_print').onclick = () => window.print();
    document.getElementById('od_start').onclick = async () => { if (!orderId) return; await fetch(`/api/orders/${orderId}/start`,{method:'POST'}); document.getElementById('od_status').textContent='Picking iniciado.'; };
    document.getElementById('od_finish').onclick = async () => { if (!orderId) return; await fetch(`/api/orders/${orderId}/finish`,{method:'POST'}); document.getElementById('od_status').textContent='Pedido finalizado e baixado.'; await loadPickList(); };

    // Modo filtros
    const products = await fetch('/api/products').then(r=>r.json()).catch(()=>[]);
    const uniq = arr => Array.from(new Set(arr.filter(Boolean)));
    const modelos = uniq(products.map(p=>p.modelo));
    const grades  = uniq(products.map(p=>p.grade));
    const mats    = uniq(products.map(p=>p.material));
    const vars    = uniq(products.map(p=>p.variacao));

    let sel = { modelo:[], grade:[], material:[], variacao:[] };
    function chipMulti(container, values, onChange){
      container.innerHTML=''; const selected = new Set();
      values.forEach(v=>{
        const btn = document.createElement('button');
        btn.type='button'; btn.textContent=v;
        btn.className='px-3 py-1 border rounded-full mr-2 mb-2';
        btn.onclick=()=>{ if(selected.has(v)){selected.delete(v); btn.classList.remove('bg-gray-900','text-white');}
                          else {selected.add(v); btn.classList.add('bg-gray-900','text-white');}
                          onChange(Array.from(selected)); };
        container.appendChild(btn);
      });
      onChange([]);
    }
    chipMulti(document.getElementById('f_modelo'), modelos, v=>sel.modelo=v);
    chipMulti(document.getElementById('f_grade'),  grades,  v=>sel.grade=v);
    chipMulti(document.getElementById('f_material'), mats, v=>sel.material=v);
    chipMulti(document.getElementById('f_variacao'), vars, v=>sel.variacao=v);

    const rows = document.getElementById('f_rows');
    document.getElementById('f_limpar').onclick = ()=>{ rows.innerHTML=''; };
    document.getElementById('f_gerar').onclick = ()=>{
      rows.innerHTML='';
      const hit = products.filter(p =>
        (sel.modelo.length===0   || sel.modelo.includes(p.modelo)) &&
        (sel.grade.length===0    || sel.grade.includes(p.grade)) &&
        (sel.material.length===0 || sel.material.includes(p.material)) &&
        (sel.variacao.length===0 || sel.variacao.includes(p.variacao))
      );
      hit.forEach(p=>{
        const tr = document.createElement('tr'); tr.className='border-b';
        const name = `${p.modelo} ${p.material} ${p.variacao} ${p.grade}`;
        tr.innerHTML = `<td class="py-2 pr-3">${name}</td>
                        <td class="py-2 pr-3"><input data-pid="${p.id}" type="number" min="0" class="w-24 border rounded px-2 py-1" value="0"></td>
                        <td class="py-2 pr-3"><button class="px-2 py-1 border rounded text-sm">Remover</button></td>`;
        tr.querySelector('button').onclick = ()=>tr.remove();
        rows.appendChild(tr);
      });
    };
    document.getElementById('f_criar').onclick = async ()=>{
      const items = Array.from(rows.querySelectorAll('input[type=number]'))
        .map(inp => ({ productId: Number(inp.dataset.pid), requested: Number(inp.value||0) }))
        .filter(it => it.requested>0);
      if (items.length===0){ document.getElementById('f_msg').textContent='Nenhuma quantidade > 0'; return; }
      const res = await fetch('/api/orders', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ items }) });
      const j = await res.json();
      if (!j.ok){ document.getElementById('f_msg').textContent=j.error||'Erro'; return; }
      orderId = j.order.id;
      document.getElementById('f_msg').textContent = `Pedido #${orderId} criado.`;
      document.getElementById('od_after').classList.remove('hidden');
    };
  }

  // ===== Organização =====
  async function renderOrganizacao() {
    const el = document.getElementById('page-organizacao');
    if (!el || el.dataset.ready === '1') return; el.dataset.ready='1';
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
        <p class="text-sm mt-3">Leia cada QR após mover para aplicar em <code>/api/reorg/scan</code>.</p>
      </div>`;
    const rows = document.getElementById('rg_rows');
    document.getElementById('rg_plan').onclick = async ()=>{
      const maxMoves = Number(document.getElementById('rg_max').value||100);
      const r = await fetch('/api/reorg/plan', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ maxMoves }) });
      const j = await r.json();
      rows.innerHTML='';
      (j.plan?.moves||[]).forEach(m=>{
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
  }

  // ===== Inicialização / Injeção de menu =====
  function init() {
    ensurePages();

    const root = findSidebarRoot();
    const ref = findReferenceLink(root);
    if (root) {
      // Evita duplicar
      if (!root.querySelector('a[href="#pedidos"]')) appendMenu(root, ref, 'Pedidos', '#pedidos');
      if (!root.querySelector('a[href="#organizacao"]')) appendMenu(root, ref, 'Organização', '#organizacao');
    } else {
      console.warn('[inject-tabs] Sidebar não encontrada — adicionando atalhos no topo.');
      // Fallback: injeta links no topo
      const top = document.createElement('div');
      top.className='p-2';
      top.innerHTML = '<a href="#pedidos" class="mr-3 underline">Pedidos</a><a href="#organizacao" class="underline">Organização</a>';
      document.body.prepend(top);
    }

    window.addEventListener('hashchange', showPageFromHash);
    showPageFromHash();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
