(()=>{
  const ids=['homePendingBoxes','homeProducedBoxes','homeTotalBoxes','productionProgressPct','productionProgressBar','homeDebtorCustomers','homeReceivableAmount','homeOverdueText','financeProgressPct','financeProgressBar'];
  function ensure(){
    const missing=ids.filter(id=>!document.getElementById(id));
    if(!missing.length)return;
    let box=document.getElementById('cardCompatMetrics');
    if(!box){box=document.createElement('div');box.id='cardCompatMetrics';box.hidden=true;document.body.appendChild(box)}
    missing.forEach(id=>{const el=document.createElement(id.endsWith('Bar')?'span':'span');el.id=id;box.appendChild(el)})
  }
  document.addEventListener('DOMContentLoaded',()=>{ensure();new MutationObserver(ensure).observe(document.getElementById('heroCards')||document.body,{childList:true,subtree:true})});
})();