(()=>{
  let deferredPrompt=null;
  const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;

  async function registerSW(){
    if(!('serviceWorker' in navigator))return;
    try{await navigator.serviceWorker.register('/service-worker.js',{scope:'/'});}catch(e){console.warn('SW registration failed',e)}
  }

  function ensureInstallButton(){
    const systemCard=[...document.querySelectorAll('#page-settings .settings-card')].find(c=>c.querySelector('h2')?.textContent.trim()==='Sistema');
    if(!systemCard||document.getElementById('installPwaBtn'))return;
    const links=systemCard.querySelector('.settings-links')||systemCard;
    const btn=document.createElement('button');
    btn.id='installPwaBtn';
    btn.type='button';
    btn.textContent=isStandalone()?'Aplicativo instalado ✓':'Instalar aplicativo';
    btn.disabled=isStandalone();
    btn.style.display=deferredPrompt||isStandalone()?'':'none';
    btn.addEventListener('click',async()=>{
      if(!deferredPrompt)return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(()=>null);
      deferredPrompt=null;
      btn.textContent='Aplicativo instalado ✓';
      btn.disabled=true;
    });
    links.prepend(btn);
  }

  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredPrompt=e;
    ensureInstallButton();
    const btn=document.getElementById('installPwaBtn');if(btn)btn.style.display='';
  });
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    const btn=document.getElementById('installPwaBtn');if(btn){btn.textContent='Aplicativo instalado ✓';btn.disabled=true;btn.style.display='';}
  });
  document.addEventListener('DOMContentLoaded',()=>{registerSW();ensureInstallButton();});
})();
