(() => {
  'use strict';
  const form = document.getElementById('tripForm');
  const steps = [...document.querySelectorAll('.step')];
  const stepLinks = [...document.querySelectorAll('[data-go-step]')];
  let current = 1;
  const STORAGE_KEY = 'relatorioViagemDraftV1';
  const MAX_DRAFT_BYTES = 40 * 1024;

  const $ = id => document.getElementById(id);
  const formatDateInput = d => {
    const p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  };

  // Higienização no cliente: remove controles e caracteres comumente usados em markup.
  // A validação do backend continua obrigatória para tudo que for enviado à API.
  const stripControls = value => String(value ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>`]/g, '');
  const cleanSingleLine = value => stripControls(value).replace(/[\r\n\t]+/g,' ').replace(/\s{2,}/g,' ');
  const cleanMultiline = value => stripControls(value).replace(/\r\n?/g,'\n').replace(/\t/g,' ');

  if (!$('dataRelatorio').value) $('dataRelatorio').value = formatDateInput(new Date());

  function maskCpf(v){
    const n=String(v||'').replace(/\D/g,'').slice(0,11);
    return n.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  }
  $('cpf').addEventListener('input', e => e.target.value = maskCpf(e.target.value));
  $('diarias').addEventListener('input', e => { e.target.value = cleanSingleLine(e.target.value).toUpperCase(); });
  $('valor').addEventListener('blur', e => {
    const raw=cleanSingleLine(e.target.value).trim(); if(!raw) return;
    const n=Number(raw.replace(/\./g,'').replace(',','.'));
    if(Number.isFinite(n)) e.target.value=n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  });

  // Higieniza os demais campos de texto sem interferir em radios, checkboxes e datas.
  form.querySelectorAll('input[type="text"], input:not([type]), textarea').forEach(el => {
    if (el.id === 'cpf' || el.id === 'diarias') return;
    el.addEventListener('blur', () => {
      el.value = el.tagName === 'TEXTAREA' ? cleanMultiline(el.value) : cleanSingleLine(el.value);
      saveDraft();
    });
  });

  document.querySelectorAll('input[name="periodoTipo"]').forEach(el => el.addEventListener('change', () => {
    const other = form.periodoTipo.value === 'outro';
    $('periodDates').hidden=!other; $('periodHint').hidden=!other; saveDraft();
  }));
  $('anexoOutros').addEventListener('change', () => { $('outrosWrap').hidden=!$('anexoOutros').checked; saveDraft(); });

  [['objetivo','objetivoCount'],['atividades','atividadesCount'],['observacoes','observacoesCount']].forEach(([a,b])=>{
    const el=$(a); const update=()=>$(b).textContent=String(el.value.length); el.addEventListener('input',update); update();
  });

  function showStep(n){
    current=Math.max(1,Math.min(6,Number(n)||1));
    steps.forEach(s=>s.classList.toggle('active',Number(s.dataset.step)===current));
    stepLinks.forEach(link=>{
      const active=Number(link.dataset.goStep)===current;
      link.classList.toggle('active',active);
      if(active) link.setAttribute('aria-current','step'); else link.removeAttribute('aria-current');
    });
    $('stepLabel').textContent=`Etapa ${current} de 6`;
    $('progressBar').style.width=`${current/6*100}%`;
    $('prevBtn').style.visibility=current===1?'hidden':'visible';
    $('nextBtn').hidden=current===6;
    $('finishActions').hidden=current!==6;
    if(current===6 && !$('local').value.trim() && $('origem').value.trim()){ $('local').value=normalizeLocation($('origem').value); saveDraft(); }
    window.scrollTo({top:0,behavior:'smooth'});
  }

  stepLinks.forEach(link=>link.addEventListener('click',()=>showStep(link.dataset.goStep)));
  $('nextBtn').addEventListener('click',()=>showStep(current+1));
  $('prevBtn').addEventListener('click',()=>showStep(current-1));

  function serialize(){
    const fd=new FormData(form); const obj={};
    for(const [k,v] of fd.entries()){
      const safe = typeof v === 'string' ? (['objetivo','atividades','observacoes'].includes(k) ? cleanMultiline(v) : cleanSingleLine(v)) : v;
      if(k==='anexos') (obj.anexos ||= []).push(safe); else obj[k]=safe;
    }
    obj.anexos ||= [];
    return obj;
  }
  function restore(obj){
    if(!obj || typeof obj!=='object' || Array.isArray(obj)) return;
    Object.entries(obj).forEach(([k,v])=>{
      if(k==='anexos' || typeof k!=='string') return;
      const els=form.querySelectorAll(`[name="${CSS.escape(k)}"]`);
      els.forEach(el=>{
        if(el.type==='radio') el.checked=el.value===v;
        else if(el.type!=='checkbox') el.value=typeof v==='string' ? v.slice(0, Number(el.maxLength)>0 ? el.maxLength : 5000) : '';
      });
    });
    (Array.isArray(obj.anexos)?obj.anexos:[]).forEach(v=>{
      if(typeof v!=='string') return;
      const el=form.querySelector(`input[name="anexos"][value="${CSS.escape(v)}"]`); if(el) el.checked=true;
    });
    $('periodDates').hidden=form.periodoTipo.value!=='outro'; $('periodHint').hidden=form.periodoTipo.value!=='outro';
    $('outrosWrap').hidden=!$('anexoOutros').checked;
    ['objetivo','atividades','observacoes'].forEach(id=>$(id).dispatchEvent(new Event('input')));
  }
  let saveTimer;
  function saveDraft(){
    clearTimeout(saveTimer); saveTimer=setTimeout(()=>{
      try{
        const json=JSON.stringify(serialize());
        if(new Blob([json]).size > MAX_DRAFT_BYTES) throw new Error('Rascunho excede o limite local.');
        localStorage.setItem(STORAGE_KEY,json); $('saveState').textContent='Rascunho salvo';
      }catch(_){ $('saveState').textContent='Não foi possível salvar'; }
    },250);
  }
  form.addEventListener('input',saveDraft); form.addEventListener('change',saveDraft);
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw && raw.length <= MAX_DRAFT_BYTES){ const saved=JSON.parse(raw); restore(saved); }
  }catch{}
  if(!$('dataRelatorio').value) $('dataRelatorio').value=formatDateInput(new Date());

  $('btnClear').addEventListener('click',()=>{
    if(!confirm('Limpar todos os campos deste relatório?')) return;
    form.reset(); localStorage.removeItem(STORAGE_KEY); $('dataRelatorio').value=formatDateInput(new Date()); restore({}); showStep(1);
  });



  // Facilidades para Origem, Destino e Local: histórico local, inversão e reaproveitamento da origem.
  const LOCATION_HISTORY_KEY='relatorioViagemLocaisV1';
  const locationIds=['origem','destino','local'];
  function normalizeLocation(value){ return cleanSingleLine(value).trim().replace(/\s+/g,' ').toUpperCase().slice(0,60); }
  function getLocationHistory(){
    try{
      const list=JSON.parse(localStorage.getItem(LOCATION_HISTORY_KEY)||'[]');
      return Array.isArray(list)?list.filter(v=>typeof v==='string'&&v.trim()).slice(0,12):[];
    }catch(_){ return []; }
  }
  function renderLocationSuggestions(){
    const dl=$('locationSuggestions'); if(!dl) return;
    dl.replaceChildren(...getLocationHistory().map(v=>{const o=document.createElement('option');o.value=v;return o;}));
  }
  function rememberLocation(value){
    const v=normalizeLocation(value); if(!v) return;
    const next=[v,...getLocationHistory().filter(x=>x!==v)].slice(0,12);
    try{localStorage.setItem(LOCATION_HISTORY_KEY,JSON.stringify(next));}catch(_){}
    renderLocationSuggestions();
  }
  locationIds.forEach(id=>{
    const el=$(id); if(!el) return;
    el.addEventListener('blur',()=>{el.value=normalizeLocation(el.value);rememberLocation(el.value);saveDraft();});
  });
  renderLocationSuggestions();
  $('swapLocations')?.addEventListener('click',()=>{
    const origem=$('origem'),destino=$('destino');
    [origem.value,destino.value]=[destino.value,origem.value];
    rememberLocation(origem.value);rememberLocation(destino.value);saveDraft();
  });

  // Ajuda rápida do PAE, sem sair do aplicativo.
  $('openPaeHelp')?.addEventListener('click',()=>$('paeHelpDialog')?.showModal());
  $('closePaeHelp')?.addEventListener('click',()=>$('paeHelpDialog')?.close());
  $('paeHelpDialog')?.addEventListener('click',e=>{if(e.target===$('paeHelpDialog')) $('paeHelpDialog').close();});

  window.RelatorioSecurity = Object.freeze({cleanSingleLine, cleanMultiline});
  window.RelatorioApp={serialize,showStep};
  showStep(1);

  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
})();
