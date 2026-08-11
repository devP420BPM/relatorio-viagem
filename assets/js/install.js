(() => {
  'use strict';
  const banner=document.getElementById('installBanner');
  if(!banner) return;
  const title=document.getElementById('installTitle');
  const text=document.getElementById('installText');
  const action=document.getElementById('installAction');
  const later=document.getElementById('installLater');
  const SNOOZE_KEY='relatorioViagemInstallSnoozeV1';
  const SNOOZE_MS=7*24*60*60*1000;
  let deferredPrompt=null;
  let hideTimer=null;

  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
  const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  const snoozed=()=>{
    const until=Number(localStorage.getItem(SNOOZE_KEY)||0);
    return Number.isFinite(until) && until>Date.now();
  };
  const snooze=()=>{ try{localStorage.setItem(SNOOZE_KEY,String(Date.now()+SNOOZE_MS));}catch(_){} };
  const hide=()=>{ banner.hidden=true; banner.classList.remove('show'); if(hideTimer)clearTimeout(hideTimer); };
  const show=(mode)=>{
    if(standalone()||snoozed()) return;
    if(mode==='ios'){
      title.textContent='Adicionar à Tela de Início';
      text.textContent='No iPhone/iPad, toque em Compartilhar e depois em “Adicionar à Tela de Início”.';
      action.textContent='Entendi';
      action.dataset.mode='ios';
      later.textContent='Agora não';
    }else{
      title.textContent='Instalar Relatório de Viagem';
      text.textContent='Instale para abrir mais rápido, em tela cheia, como um aplicativo.';
      action.textContent='Instalar';
      action.dataset.mode='android';
      later.textContent='Agora não';
    }
    banner.hidden=false;
    requestAnimationFrame(()=>banner.classList.add('show'));
    hideTimer=setTimeout(hide,15000);
  };

  later.addEventListener('click',()=>{snooze();hide();});
  action.addEventListener('click',async()=>{
    if(action.dataset.mode==='ios'){
      snooze(); hide(); return;
    }
    if(!deferredPrompt){ hide(); return; }
    try{
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    }catch(_){}
    deferredPrompt=null;
    hide();
  });

  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredPrompt=e;
    setTimeout(()=>show('android'),1800);
  });
  window.addEventListener('appinstalled',()=>{try{localStorage.removeItem(SNOOZE_KEY);}catch(_){} hide();});

  window.addEventListener('load',()=>{
    if(isIOS()&&!standalone()&&!snoozed()) setTimeout(()=>show('ios'),2200);
  });
})();
