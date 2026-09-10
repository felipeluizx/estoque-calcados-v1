(() => {
  const qs = (s) => document.querySelector(s);
  const qsa = (s) => [...document.querySelectorAll(s)];

  function goLegacy(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    window.location.assign('/legacy?from=v2');
  }

  function stripPcText(root = document) {
    root.querySelectorAll('.customer-col .meta, .breakdown-top .meta, #itemDetailSubtitle').forEach((el) => {
      el.textContent = el.textContent.replace(/\s*·\s*PC\s+[^·]+/gi, '').replace(/\s{2,}/g, ' ').trim();
    });
    const pcInput = root.querySelector('#itemOrderPc');
    if (pcInput?.closest('.detail-field')) pcInput.closest('.detail-field').style.display = 'none';
  }

  function dateWithinPeriod(value, period) {
    if (!value || period === 'all') return true;
    const d = new Date(String(value).slice(0, 10) + 'T12:00:00');
    const now = new Date();
    if (period === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    const days = Number(period);
    if (!Number.isFinite(days)) return true;
    const min = new Date(now);
    min.setHours(0,0,0,0);
    min.setDate(min.getDate() - days + 1);
    return d >= min;
  }

  function homePeriod() {
    return state?.prefs?.homePeriod || 'current';
  }

  function productionInHomePeriod() {
    const period = homePeriod();
    if (period === 'current') return state.production.filter(i => Number(i.quantity_remaining) > 0);
    return state.production.filter(i => dateWithinPeriod(i.order_date, period));
  }

  function receivablesInHomePeriod() {
    const period = homePeriod();
    if (period === 'current' || period === 'all') return state.receivables;
    return state.receivables.filter(r => dateWithinPeriod(r.created_at || r.due_date, period));
  }

  function patchSettings() {
    const systemLinks = qs('#page-settings .settings-links');
    if (systemLinks && !qs('#managePricesBtn')) {
      const btn = document.createElement('button');
      btn.id = 'managePricesBtn';
      btn.textContent = 'Gerenciar preços-base dos SKUs →';
      btn.onclick = () => window.location.assign('/precos.html');
      systemLinks.prepend(btn);
    }

    const homeCard = [...qsa('#page-settings .settings-card')].find(c => c.querySelector('h2')?.textContent.trim() === 'Home');
    if (homeCard && !qs('#homePeriodSetting')) {
      const wrap = document.createElement('label');
      wrap.style.display = 'grid';
      wrap.style.gap = '8px';
      wrap.style.marginTop = '18px';
      wrap.innerHTML = '<span><strong>Período dos indicadores</strong><small style="display:block">Define quais pedidos entram no progresso e nos números da Home.</small></span><select id="homePeriodSetting"><option value="current">Pendências atuais</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="month">Este mês</option><option value="all">Todo o histórico</option></select>';
      homeCard.appendChild(wrap);
      const sel = qs('#homePeriodSetting');
      sel.value = state.prefs.homePeriod || 'current';
      sel.onchange = () => {
        state.prefs.homePeriod = sel.value;
        localStorage.setItem('estoque-v2-prefs', JSON.stringify(state.prefs));
        renderHome();
        if (typeof toast === 'function') toast('Período da Home atualizado.');
      };
    }
  }

  function patchOrdersUi() {
    const pcField = qs('#orderPc')?.closest('.field');
    if (pcField) pcField.style.display = 'none';
    const search = qs('#searchInput');
    if (search) search.placeholder = 'Buscar SKU, modelo ou cliente';
    const heads = qsa('#page-orders .list-head span');
    if (heads[2]) heads[2].textContent = 'Cliente';

    const tabs = qs('#orderTabs');
    if (tabs && !tabs.querySelector('[data-filter="completed"]')) {
      const completed = document.createElement('button');
      completed.className = 'tab';
      completed.dataset.filter = 'completed';
      completed.textContent = 'Concluídos';
      tabs.appendChild(completed);
      completed.onclick = () => { state.orderFilter = 'completed'; syncOrderTabs(); renderProduction(); };
    }
  }

  const originalRenderHome = window.renderHome;
  window.renderHome = function() {
    const rows = productionInHomePeriod();
    const active = rows.filter(i => Number(i.quantity_remaining) > 0);
    const ordered = rows.reduce((s,i) => s + Number(i.quantity_ordered || 0), 0);
    const produced = rows.reduce((s,i) => s + Number(i.quantity_produced || 0), 0);
    const pending = active.reduce((s,i) => s + Number(i.quantity_remaining || 0), 0);
    const pct = ordered ? Math.min(100, Math.round(produced / ordered * 100)) : 0;
    qs('#homePendingBoxes').textContent = pending;
    qs('#homeProducedBoxes').textContent = produced;
    qs('#homeTotalBoxes').textContent = ordered;
    qs('#productionProgressPct').textContent = pct + '%';
    qs('#productionProgressBar').style.width = pct + '%';
    qs('#homePartialItems').textContent = active.filter(i => i.production_status === 'partial').length;
    qs('#homeOverdueOrders').textContent = new Set(active.filter(isOverdue).map(i => i.order_id)).size;
    qs('#homeOpenOrders').textContent = new Set(active.map(i => i.order_id)).size;

    const financialRows = receivablesInHomePeriod();
    const open = financialRows.filter(r => Number(r.amount_remaining) > 0);
    const total = open.reduce((s,r) => s + Number(r.amount_remaining || 0), 0);
    const debtors = new Set(open.map(r => r.customer_id)).size;
    const overdue = open.filter(r => r.financial_status === 'overdue');
    const overdueTotal = overdue.reduce((s,r) => s + Number(r.amount_remaining || 0), 0);
    qs('#homeDebtorCustomers').textContent = debtors;
    qs('#homeReceivableAmount').textContent = money(total);
    qs('#homeOverdueText').textContent = overdueTotal ? `${money(overdueTotal)} vencidos` : 'Nenhum valor vencido';
    const allAmount = financialRows.reduce((s,r) => s + Number(r.amount || 0), 0);
    const allPaid = financialRows.reduce((s,r) => s + Number(r.amount_paid || 0) + Number(r.adjustment || 0), 0);
    const fpct = allAmount ? Math.min(100, Math.round(allPaid / allAmount * 100)) : 0;
    qs('#financeProgressPct').textContent = fpct + '%';
    qs('#financeProgressBar').style.width = fpct + '%';

    const map = new Map();
    active.forEach(i => {
      const id = Number(i.product_id);
      if (!map.has(id)) map.set(id, {product_id:id, remaining:0, customers:new Set(), priority:0, due_date:null});
      const g = map.get(id);
      g.remaining += Number(i.quantity_remaining || 0);
      g.customers.add(Number(i.customer_id));
      g.priority = Math.max(g.priority, Number(i.priority || 0));
      if (i.due_date && (!g.due_date || String(i.due_date) < String(g.due_date))) g.due_date = i.due_date;
    });
    const groups = [...map.values()].sort((a,b) => b.priority-a.priority || String(a.due_date||'9999').localeCompare(String(b.due_date||'9999')) || b.remaining-a.remaining).slice(0,7);
    qs('#homeProductionList').innerHTML = groups.length ? groups.map(g => {
      const p = productById(g.product_id);
      return `<div class="home-product-row" data-product-id="${g.product_id}"><div><div class="product-title">${esc(p.modelo||p.sku||'Produto')}</div><div class="meta">${esc(productLabel(p))}</div></div><div class="home-clients"><strong>${g.customers.size}</strong><div class="meta">cliente${g.customers.size===1?'':'s'}</div></div><div class="metric"><strong>${g.remaining} cx</strong><span>pendentes</span></div><div>›</div></div>`;
    }).join('') : '<div class="empty">Nenhuma produção pendente neste período.</div>';
    qsa('#homeProductionList [data-product-id]').forEach(r => r.onclick = () => openProductDetail(Number(r.dataset.productId)));
    applyPrefs();
  };

  window.orderRowHtml = function(i, checkbox = true) {
    const p = productById(i.product_id), overdue = isOverdue(i), completed = i.production_status === 'completed', checked = state.selected.has(Number(i.order_item_id)) ? 'checked' : '';
    const badge = completed ? '<span class="badge">Concluído</span>' : overdue ? '<span class="badge overdue">Atrasado</span>' : i.production_status === 'partial' ? '<span class="badge partial">Parcial</span>' : '<span class="badge">Pendente</span>';
    const remainingLabel = completed ? `${i.quantity_ordered} cx` : `${i.quantity_remaining} cx`;
    const remainingCaption = completed ? 'concluídas' : `${i.quantity_produced}/${i.quantity_ordered} produzidas`;
    return `<div class="order-row" data-item-id="${i.order_item_id}">${checkbox && !completed ? `<input class="check row-check" type="checkbox" data-id="${i.order_item_id}" ${checked}>` : '<span></span>'}<div><div class="product-title">${esc(p.modelo||p.sku||'Produto')}</div><div class="meta">${esc(productLabel(p))}</div></div><div class="customer-col"><div class="meta">${esc(i.customer_name)}</div>${badge}</div><div class="metric"><strong>${remainingLabel}</strong><span>${remainingCaption}</span></div><div class="price-col"><strong class="money-private">${i.unit_price==null?'—':money(i.unit_price)}</strong><div class="meta">por caixa</div></div><div>›</div></div>`;
  };

  window.renderProduction = function() {
    const q = (qs('#searchInput')?.value || '').trim().toLowerCase();
    let rows = [...state.production];
    rows = rows.filter(i => {
      const p = productById(i.product_id);
      const hay = [p.modelo,p.sku,p.grade,p.material,p.variacao,i.customer_name].join(' ').toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (state.orderFilter === 'pending') return i.production_status === 'pending';
      if (state.orderFilter === 'partial') return i.production_status === 'partial';
      if (state.orderFilter === 'overdue') return isOverdue(i);
      if (state.orderFilter === 'completed') return i.production_status === 'completed';
      return true;
    });
    rows = sortProduction(rows);
    qs('#productionList').innerHTML = rows.length ? rows.map(i => orderRowHtml(i, true)).join('') : '<div class="empty">Nenhum pedido encontrado.</div>';
    qsa('#productionList .row-check').forEach(cb => cb.onclick = e => { e.stopPropagation(); cb.checked ? state.selected.add(Number(cb.dataset.id)) : state.selected.delete(Number(cb.dataset.id)); updateSelection(); });
    qsa('#productionList [data-item-id]').forEach(r => r.onclick = e => { if (e.target.closest('.row-check')) return; openItemDetail(Number(r.dataset.itemId)); });
    updateSelection();
    applyPrefs();
    stripPcText(qs('#productionList'));
  };

  function removePcFromDynamicDetails() {
    stripPcText(document);
    const pc = qs('#itemOrderPc');
    if (pc) pc.value = '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    [qs('#openLegacyBtn'), qs('#legacyStockLink')].filter(Boolean).forEach(el => el.onclick = goLegacy);
    patchSettings();
    patchOrdersUi();
    const orderPc = qs('#orderPc');
    if (orderPc) orderPc.value = '';
    const period = qs('#homePeriodSetting');
    if (period) period.value = state.prefs.homePeriod || 'current';
    renderHome();
    renderProduction();
    removePcFromDynamicDetails();
  });

  const observer = new MutationObserver(() => removePcFromDynamicDetails());
  observer.observe(document.body, {childList:true, subtree:true});
})();
