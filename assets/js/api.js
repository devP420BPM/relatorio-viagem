(() => {
  'use strict';
  const cfg=window.APP_CONFIG||{};
  const $=id=>document.getElementById(id);
  const sec=window.RelatorioSecurity||{};
  const safeLine=v=>(sec.cleanSingleLine?sec.cleanSingleLine(v):String(v||'').replace(/[<>`\x00-\x1F\x7F]/g,' ')).trim();
  const onlyDigits=v=>String(v||'').replace(/\D/g,'');
  const message=(txt,ok=false)=>{const e=$('apiMessage');e.hidden=false;e.textContent=safeLine(txt).slice(0,240);e.classList.toggle('ok',ok)};
  const endpoint=()=>String(cfg.API_URL||'').trim();

  async function apiGet(params){
    if(!endpoint()) throw new Error('API ainda não configurada. O formulário e a geração do PDF continuam disponíveis.');
    const u=new URL(endpoint());
    if(u.protocol!=='https:') throw new Error('A API deve usar HTTPS.');
    Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,safeLine(v).slice(0,120)));
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const r=await fetch(u.toString(),{method:'GET',redirect:'follow',cache:'no-store',credentials:'omit',signal:controller.signal});
      if(!r.ok) throw new Error('Falha ao consultar a API.');
      const j=await r.json(); if(!j||typeof j!=='object') throw new Error('Resposta inválida da API.'); return j;
    } finally { clearTimeout(timer); }
  }
  async function lookup(type,value){
    value=safeLine(value); if(!value) return;
    try{
      message('Consultando...'); const j=await apiGet({action:'lookup',type,value});
      if(!j.ok) throw new Error(j.message||'Cadastro não localizado.');
      if(type==='nome') return showNames(Array.isArray(j.results)?j.results:[]);
      fill(j.data); message('Cadastro localizado e preenchido.',true);
    }catch(e){message(e.name==='AbortError'?'Consulta demorou demais. Tente novamente.':(e.message||'Não foi possível consultar.'));}
  }
  function fill(d){
    if(!d||typeof d!=='object')return;
    $('cpf').value=formatCpf(d.cpf||'');
    $('nome').value=safeLine(d.nome||'').slice(0,100);
    $('rg').value=safeLine(d.rg||'').slice(0,20);
  }
  function formatCpf(v){const n=onlyDigits(v).slice(0,11);return n.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')}
  function showNames(list){
    const box=$('nameResults'); box.replaceChildren();
    if(!list.length){box.hidden=true;throw new Error('Nenhum nome localizado.');}
    list.slice(0,10).forEach(d=>{
      if(!d||typeof d!=='object') return;
      const b=document.createElement('button');b.type='button';b.className='suggestion';
      b.textContent=`${safeLine(d.nome).slice(0,100)} • CPF final ${onlyDigits(d.cpf).slice(-4)}`;
      b.onclick=()=>{fill(d);box.hidden=true;message('Cadastro selecionado.',true)};box.appendChild(b)
    });
    box.hidden=box.childElementCount===0;
    message(`${box.childElementCount} resultado(s) encontrado(s).`,true);
  }

  $('lookupCpf').onclick=()=>lookup('cpf',onlyDigits($('cpf').value).slice(0,11));
  $('lookupRg').onclick=()=>lookup('rg',safeLine($('rg').value).slice(0,20));
  $('lookupNome').onclick=()=>{const n=safeLine($('nome').value).slice(0,100); if(n.length<5)return message('Digite pelo menos 5 caracteres do nome.'); lookup('nome',n)};

  $('saveIdentity').onclick=async()=>{
    const data={action:'save',cpf:onlyDigits($('cpf').value).slice(0,11),rg:safeLine($('rg').value).slice(0,20),nome:safeLine($('nome').value).slice(0,100)};
    if(data.cpf.length!==11||!data.rg||data.nome.length<3) return message('Preencha Nome, CPF e RG antes de salvar.');
    if(!endpoint()) return message('API ainda não configurada. Assim que o Apps Script for publicado, este botão gravará Nome, CPF e RG na base.');
    try{
      const u=new URL(endpoint()); if(u.protocol!=='https:') throw new Error('A API deve usar HTTPS.');
      message('Salvando cadastro...');
      const body=new URLSearchParams(data); const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),12000);
      let r;
      try{r=await fetch(u.toString(),{method:'POST',body,redirect:'follow',cache:'no-store',credentials:'omit',signal:controller.signal});}finally{clearTimeout(timer)}
      if(!r.ok) throw new Error('Falha ao salvar na API.');
      const j=await r.json(); if(!j||typeof j!=='object') throw new Error('Resposta inválida da API.');
      if(!j.ok) throw new Error(j.message||'Não foi possível salvar.');
      localStorage.setItem('relatorioViagemIdentidadeV1',JSON.stringify({cpf:data.cpf,rg:data.rg,nome:data.nome}));
      message(j.message||'Cadastro salvo para próximas utilizações.',true);
    }catch(e){message(e.name==='AbortError'?'Operação demorou demais. Tente novamente.':(e.message||'Não foi possível salvar o cadastro.'));}
  };
})();
