(() => {
  'use strict';
  const cfg=window.APP_CONFIG||{};
  const $=id=>document.getElementById(id);
  const sec=window.RelatorioSecurity||{};
  const safeLine=v=>(sec.cleanSingleLine?sec.cleanSingleLine(v):String(v||'').replace(/[<>`\x00-\x1F\x7F]/g,' ')).trim();
  const onlyDigits=v=>String(v||'').replace(/\D/g,'');
  const endpoint=()=>String(cfg.API_URL||'').trim();
  const message=(txt,ok=false)=>{const e=$('apiMessage');e.hidden=false;e.textContent=safeLine(txt).slice(0,240);e.classList.toggle('ok',ok)};
  const clearMessage=()=>{const e=$('apiMessage');e.hidden=true;e.textContent='';e.classList.remove('ok')};
  const formatCpf=v=>onlyDigits(v).slice(0,11).replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');

  let lookupController=null;
  let saveController=null;
  let seq=0;
  let debounceTimer=null;
  let saveTimer=null;
  let programmaticFill=false;
  let lastSavedFingerprint='';
  let savingFingerprint='';

  function isValidCpf(cpf){
    cpf=onlyDigits(cpf);
    if(cpf.length!==11 || /^(\d)\1{10}$/.test(cpf)) return false;
    for(let t=9;t<11;t++){
      let sum=0;
      for(let i=0;i<t;i++) sum+=Number(cpf[i])*(t+1-i);
      let d=(sum*10)%11;
      if(d===10) d=0;
      if(d!==Number(cpf[t])) return false;
    }
    return true;
  }

  function identityData(){
    return {
      action:'save',
      cpf:onlyDigits($('cpf').value).slice(0,11),
      rg:safeLine($('rg').value).slice(0,20),
      nome:safeLine($('nome').value).slice(0,100)
    };
  }

  function identityFingerprint(data){
    return `${data.cpf}|${data.rg.toUpperCase().replace(/[^0-9A-Z]/g,'')}|${data.nome.toUpperCase().replace(/\s+/g,' ').trim()}`;
  }

  function readyToSave(data){
    return isValidCpf(data.cpf) && data.rg.replace(/[^0-9A-Za-z]/g,'').length>=3 && data.nome.length>=3;
  }

  async function apiGet(params){
    if(!endpoint()) throw new Error('API ainda não configurada.');
    const u=new URL(endpoint());
    if(u.protocol!=='https:') throw new Error('A API deve usar HTTPS.');
    Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,safeLine(v).slice(0,120)));
    if(lookupController) lookupController.abort();
    lookupController=new AbortController();
    const timer=setTimeout(()=>lookupController.abort(),10000);
    try{
      const r=await fetch(u.toString(),{method:'GET',redirect:'follow',cache:'no-store',credentials:'omit',signal:lookupController.signal});
      if(!r.ok) throw new Error('Falha ao consultar a API.');
      const j=await r.json();
      if(!j||typeof j!=='object') throw new Error('Resposta inválida da API.');
      return j;
    } finally { clearTimeout(timer); }
  }

  async function apiSave(data){
    if(!endpoint()) return;
    const fingerprint=identityFingerprint(data);
    if(!fingerprint || fingerprint===lastSavedFingerprint || fingerprint===savingFingerprint) return;

    const u=new URL(endpoint());
    if(u.protocol!=='https:') return;
    if(saveController) saveController.abort();
    saveController=new AbortController();
    savingFingerprint=fingerprint;
    const timer=setTimeout(()=>saveController.abort(),10000);

    try{
      const body=new URLSearchParams(data);
      const r=await fetch(u.toString(),{method:'POST',body,redirect:'follow',cache:'no-store',credentials:'omit',signal:saveController.signal});
      if(!r.ok) throw new Error('Falha ao sincronizar o cadastro.');
      const j=await r.json();
      if(!j||typeof j!=='object') throw new Error('Resposta inválida da API.');
      if(!j.ok){
        message(j.message||'Não foi possível sincronizar o cadastro.');
        return;
      }
      lastSavedFingerprint=fingerprint;
      clearMessage();
    }catch(e){
      if(e.name!=='AbortError') message('Não foi possível sincronizar o cadastro agora. O relatório pode continuar normalmente.');
    }finally{
      clearTimeout(timer);
      if(savingFingerprint===fingerprint) savingFingerprint='';
    }
  }

  function identityFieldFocused(){
    const a=document.activeElement;
    return a===$('cpf') || a===$('rg') || a===$('nome');
  }

  function scheduleAutoSave(delay=900){
    if(programmaticFill) return;
    clearTimeout(saveTimer);
    const data=identityData();
    if(!readyToSave(data)) return;
    const fingerprint=identityFingerprint(data);
    if(fingerprint===lastSavedFingerprint || fingerprint===savingFingerprint) return;
    saveTimer=setTimeout(()=>{
      // Não grava enquanto CPF/RG/Nome ainda está sendo digitado. Isso evita
      // cadastrar um RG parcial após uma pausa breve no teclado do celular.
      if(identityFieldFocused()) return;
      const current=identityData();
      if(readyToSave(current)) apiSave(current);
    },delay);
  }

  function fill(d){
    if(!d||typeof d!=='object') return;
    programmaticFill=true;
    $('cpf').value=formatCpf(d.cpf||'');
    $('nome').value=safeLine(d.nome||'').slice(0,100);
    $('rg').value=safeLine(d.rg||'').slice(0,20);
    $('nameResults').hidden=true;
    lastSavedFingerprint=identityFingerprint(identityData());
    programmaticFill=false;
    $('cpf').dispatchEvent(new Event('change',{bubbles:true}));
    $('nome').dispatchEvent(new Event('change',{bubbles:true}));
    $('rg').dispatchEvent(new Event('change',{bubbles:true}));
  }

  function showNames(list){
    const box=$('nameResults');
    box.replaceChildren();
    list.slice(0,8).forEach(d=>{
      if(!d||typeof d!=='object') return;
      const b=document.createElement('button');
      b.type='button';
      b.className='suggestion';
      b.textContent=`${safeLine(d.nome).slice(0,100)} • CPF final ${onlyDigits(d.cpf).slice(-4)}`;
      b.addEventListener('click',()=>{fill(d);clearMessage()});
      box.appendChild(b);
    });
    box.hidden=box.childElementCount===0;
  }

  async function lookup(type,value,requestSeq){
    try{
      const j=await apiGet({action:'lookup',type,value});
      if(requestSeq!==seq) return;
      if(!j.ok){
        if(type==='nome') $('nameResults').hidden=true;
        if(j.message==='Cadastro não localizado.') clearMessage();
        else message(j.message||'Não foi possível consultar a base.');
        return;
      }
      if(j.data){
        fill(j.data);
        clearMessage();
        return;
      }
      if(type==='nome' && Array.isArray(j.results)){
        if(j.results.length===1 && j.exact===true){
          fill(j.results[0]);
          clearMessage();
          return;
        }
        showNames(j.results);
        if(j.results.length) message('Selecione o nome correto na sugestão.',true);
        else clearMessage();
      }
    }catch(e){
      if(e.name==='AbortError') return;
      message('Não foi possível consultar a base agora. O preenchimento manual continua disponível.');
    }
  }

  function scheduleLookup(type,value,delay=450){
    if(programmaticFill) return;
    clearTimeout(debounceTimer);
    seq+=1;
    const requestSeq=seq;
    debounceTimer=setTimeout(()=>lookup(type,value,requestSeq),delay);
  }

  $('cpf').addEventListener('input',()=>{
    if(programmaticFill) return;
    $('nameResults').hidden=true;
    const cpf=onlyDigits($('cpf').value).slice(0,11);
    if(cpf.length===11){
      if(isValidCpf(cpf)) scheduleLookup('cpf',cpf,250);
      else message('CPF inválido.');
    } else clearMessage();
    scheduleAutoSave();
  });

  $('rg').addEventListener('input',()=>{
    if(programmaticFill) return;
    $('nameResults').hidden=true;
    const rg=safeLine($('rg').value).slice(0,20);
    if(rg.length>=4) scheduleLookup('rg',rg,500); else clearMessage();
    scheduleAutoSave();
  });

  $('nome').addEventListener('input',()=>{
    if(programmaticFill) return;
    const nome=safeLine($('nome').value).slice(0,100);
    if(nome.length>=5) scheduleLookup('nome',nome,600); else { $('nameResults').hidden=true; clearMessage(); }
    scheduleAutoSave();
  });

  // O cadastro em segundo plano é disparado ao concluir um dos campos.
  // No mobile, tocar no próximo campo/etapa provoca blur e salva o valor completo.
  ['cpf','rg','nome'].forEach(id=>{
    $(id).addEventListener('blur',()=>scheduleAutoSave(180));
  });

  // Se o rascunho local restaurar Nome/CPF/RG antes deste script carregar,
  // esses dados também podem ser sincronizados automaticamente sem exigir botão.
  scheduleAutoSave(1200);
})();
