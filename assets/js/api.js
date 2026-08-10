(() => {
  const cfg=window.APP_CONFIG||{};
  const $=id=>document.getElementById(id);
  const onlyDigits=v=>(v||'').replace(/\D/g,'');
  const message=(txt,ok=false)=>{const e=$('apiMessage');e.hidden=false;e.textContent=txt;e.classList.toggle('ok',ok)};
  const endpoint=()=>String(cfg.API_URL||'').trim();

  async function apiGet(params){
    if(!endpoint()) throw new Error('API ainda não configurada. O formulário e a geração do PDF continuam disponíveis.');
    const u=new URL(endpoint()); Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
    const r=await fetch(u.toString(),{method:'GET',redirect:'follow'}); if(!r.ok) throw new Error('Falha ao consultar a API.'); return r.json();
  }
  async function lookup(type,value){
    value=(value||'').trim(); if(!value) return;
    try{
      message('Consultando...'); const j=await apiGet({action:'lookup',type,value});
      if(!j.ok) throw new Error(j.message||'Cadastro não localizado.');
      if(type==='nome') return showNames(j.results||[]);
      fill(j.data); message('Cadastro localizado e preenchido.',true);
    }catch(e){message(e.message||'Não foi possível consultar.');}
  }
  function fill(d){ if(!d)return; $('cpf').value=formatCpf(d.cpf||''); $('nome').value=d.nome||''; $('rg').value=d.rg||''; }
  function formatCpf(v){const n=onlyDigits(v).slice(0,11);return n.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')}
  function showNames(list){
    const box=$('nameResults'); box.innerHTML='';
    if(!list.length){box.hidden=true;throw new Error('Nenhum nome localizado.');}
    list.slice(0,10).forEach(d=>{const b=document.createElement('button');b.type='button';b.className='suggestion';b.textContent=`${d.nome} • CPF final ${String(d.cpf||'').slice(-4)}`;b.onclick=()=>{fill(d);box.hidden=true;message('Cadastro selecionado.',true)};box.appendChild(b)});
    box.hidden=false; message(`${list.length} resultado(s) encontrado(s).`,true);
  }

  $('lookupCpf').onclick=()=>lookup('cpf',onlyDigits($('cpf').value));
  $('lookupRg').onclick=()=>lookup('rg',$('rg').value);
  $('lookupNome').onclick=()=>{const n=$('nome').value.trim(); if(n.length<5)return message('Digite pelo menos 5 caracteres do nome.'); lookup('nome',n)};

  $('saveIdentity').onclick=async()=>{
    const data={action:'save',cpf:onlyDigits($('cpf').value),rg:$('rg').value.trim(),nome:$('nome').value.trim()};
    if(data.cpf.length!==11||!data.rg||data.nome.length<3) return message('Preencha Nome, CPF e RG antes de salvar.');
    if(!endpoint()) return message('API ainda não configurada. Assim que o Apps Script for publicado, este botão gravará Nome, CPF e RG na base.');
    try{
      message('Salvando cadastro...');
      const body=new URLSearchParams(data);
      const r=await fetch(endpoint(),{method:'POST',body,redirect:'follow'}); const j=await r.json();
      if(!j.ok) throw new Error(j.message||'Não foi possível salvar.');
      localStorage.setItem('relatorioViagemIdentidadeV1',JSON.stringify({cpf:data.cpf,rg:data.rg,nome:data.nome}));
      message(j.message||'Cadastro salvo para próximas utilizações.',true);
    }catch(e){message(e.message||'Não foi possível salvar o cadastro.');}
  };
})();
