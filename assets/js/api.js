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

  let controller=null;
  let seq=0;
  let debounceTimer=null;
  let programmaticFill=false;

  async function apiGet(params){
    if(!endpoint()) throw new Error('API ainda não configurada.');
    const u=new URL(endpoint());
    if(u.protocol!=='https:') throw new Error('A API deve usar HTTPS.');
    Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,safeLine(v).slice(0,120)));
    if(controller) controller.abort();
    controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    try{
      const r=await fetch(u.toString(),{method:'GET',redirect:'follow',cache:'no-store',credentials:'omit',signal:controller.signal});
      if(!r.ok) throw new Error('Falha ao consultar a API.');
      const j=await r.json();
      if(!j||typeof j!=='object') throw new Error('Resposta inválida da API.');
      return j;
    } finally { clearTimeout(timer); }
  }

  function fill(d){
    if(!d||typeof d!=='object') return;
    programmaticFill=true;
    $('cpf').value=formatCpf(d.cpf||'');
    $('nome').value=safeLine(d.nome||'').slice(0,100);
    $('rg').value=safeLine(d.rg||'').slice(0,20);
    $('nameResults').hidden=true;
    programmaticFill=false;
    $('cpf').dispatchEvent(new Event('change',{bubbles:true}));
    $('nome').dispatchEvent(new Event('change',{bubbles:true}));
    $('rg').dispatchEvent(new Event('change',{bubbles:true}));
  }

  function showNames(list){
    const box=$('nameResults'); box.replaceChildren();
    list.slice(0,8).forEach(d=>{
      if(!d||typeof d!=='object') return;
      const b=document.createElement('button'); b.type='button'; b.className='suggestion';
      b.textContent=`${safeLine(d.nome).slice(0,100)} • CPF final ${onlyDigits(d.cpf).slice(-4)}`;
      b.addEventListener('click',()=>{fill(d);message('Cadastro localizado e preenchido.',true)});
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
        if(j.message==='Cadastro não localizado.') message('Cadastro não localizado. Você pode preencher os dados e salvá-los para a próxima vez.');
        else message(j.message||'Cadastro não localizado.');
        return;
      }
      if(j.data){ fill(j.data); message('Cadastro localizado e preenchido.',true); return; }
      if(type==='nome' && Array.isArray(j.results)){
        if(j.results.length===1 && j.exact===true){ fill(j.results[0]); message('Cadastro localizado e preenchido.',true); return; }
        showNames(j.results);
        if(j.results.length) message('Selecione o nome correto na sugestão.',true); else message('Cadastro não localizado. Você pode preencher os dados e salvá-los para a próxima vez.');
      }
    }catch(e){
      if(e.name==='AbortError') return;
      message(e.message||'Não foi possível consultar a base.');
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
    if(cpf.length===11) scheduleLookup('cpf',cpf,250); else clearMessage();
  });

  $('rg').addEventListener('input',()=>{
    if(programmaticFill) return;
    $('nameResults').hidden=true;
    const rg=safeLine($('rg').value).slice(0,20);
    if(rg.length>=4) scheduleLookup('rg',rg,500); else clearMessage();
  });

  $('nome').addEventListener('input',()=>{
    if(programmaticFill) return;
    const nome=safeLine($('nome').value).slice(0,100);
    if(nome.length>=5) scheduleLookup('nome',nome,600); else { $('nameResults').hidden=true; clearMessage(); }
  });

  $('saveIdentity').onclick=async()=>{
    const data={action:'save',cpf:onlyDigits($('cpf').value).slice(0,11),rg:safeLine($('rg').value).slice(0,20),nome:safeLine($('nome').value).slice(0,100)};
    if(data.cpf.length!==11||!data.rg||data.nome.length<3) return message('Preencha Nome, CPF e RG antes de salvar.');
    if(!endpoint()) return message('API ainda não configurada. Depois da implantação, este botão salvará Nome, CPF e RG na base.');
    try{
      const u=new URL(endpoint()); if(u.protocol!=='https:') throw new Error('A API deve usar HTTPS.');
      message('Salvando cadastro...');
      const body=new URLSearchParams(data); const c=new AbortController(); const timer=setTimeout(()=>c.abort(),10000);
      let r; try{r=await fetch(u.toString(),{method:'POST',body,redirect:'follow',cache:'no-store',credentials:'omit',signal:c.signal});}finally{clearTimeout(timer)}
      if(!r.ok) throw new Error('Falha ao salvar na API.');
      const j=await r.json(); if(!j||typeof j!=='object') throw new Error('Resposta inválida da API.');
      if(!j.ok) throw new Error(j.message||'Não foi possível salvar.');
      localStorage.setItem('relatorioViagemIdentidadeV1',JSON.stringify({cpf:data.cpf,rg:data.rg,nome:data.nome}));
      message(j.message||'Cadastro salvo para próximas utilizações.',true);
    }catch(e){message(e.name==='AbortError'?'Operação demorou demais. Tente novamente.':(e.message||'Não foi possível salvar o cadastro.'));}
  };
})();
