(() => {
  const form = document.getElementById('tripForm');
  const steps = [...document.querySelectorAll('.step')];
  let current = 1;
  const STORAGE_KEY = 'relatorioViagemDraftV1';

  const $ = id => document.getElementById(id);
  const formatDateInput = d => {
    const p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  };
  if (!$('dataRelatorio').value) $('dataRelatorio').value = formatDateInput(new Date());

  function maskCpf(v){
    const n=v.replace(/\D/g,'').slice(0,11);
    return n.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  }
  $('cpf').addEventListener('input', e => e.target.value = maskCpf(e.target.value));
  $('valor').addEventListener('blur', e => {
    const raw=e.target.value.trim(); if(!raw) return;
    const n=Number(raw.replace(/\./g,'').replace(',','.'));
    if(Number.isFinite(n)) e.target.value=n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  });

  document.querySelectorAll('input[name="periodoTipo"]').forEach(el => el.addEventListener('change', () => {
    const other = form.periodoTipo.value === 'outro';
    $('periodDates').hidden=!other; $('periodHint').hidden=!other; saveDraft();
  }));
  $('anexoOutros').addEventListener('change', () => { $('outrosWrap').hidden=!$('anexoOutros').checked; saveDraft(); });

  [['objetivo','objetivoCount'],['atividades','atividadesCount'],['observacoes','observacoesCount']].forEach(([a,b])=>{
    const el=$(a); const update=()=>$(b).textContent=el.value.length; el.addEventListener('input',update); update();
  });

  function showStep(n){
    current=Math.max(1,Math.min(6,n));
    steps.forEach(s=>s.classList.toggle('active',Number(s.dataset.step)===current));
    $('stepLabel').textContent=`Etapa ${current} de 6`;
    $('progressBar').style.width=`${current/6*100}%`;
    $('prevBtn').style.visibility=current===1?'hidden':'visible';
    $('nextBtn').hidden=current===6;
    $('finishActions').hidden=current!==6;
    window.scrollTo({top:0,behavior:'smooth'});
  }

  $('nextBtn').addEventListener('click',()=>showStep(current+1));
  $('prevBtn').addEventListener('click',()=>showStep(current-1));

  function serialize(){
    const fd=new FormData(form); const obj={};
    for(const [k,v] of fd.entries()){
      if(k==='anexos') (obj.anexos ||= []).push(v); else obj[k]=v;
    }
    obj.anexos ||= [];
    return obj;
  }
  function restore(obj){
    Object.entries(obj||{}).forEach(([k,v])=>{
      if(k==='anexos') return;
      const els=form.querySelectorAll(`[name="${CSS.escape(k)}"]`);
      els.forEach(el=>{
        if(el.type==='radio') el.checked=el.value===v;
        else if(el.type!=='checkbox') el.value=v??'';
      });
    });
    (obj?.anexos||[]).forEach(v=>{ const el=form.querySelector(`input[name="anexos"][value="${CSS.escape(v)}"]`); if(el) el.checked=true; });
    $('periodDates').hidden=form.periodoTipo.value!=='outro'; $('periodHint').hidden=form.periodoTipo.value!=='outro';
    $('outrosWrap').hidden=!$('anexoOutros').checked;
    ['objetivo','atividades','observacoes'].forEach(id=>$(id).dispatchEvent(new Event('input')));
  }
  let saveTimer;
  function saveDraft(){
    clearTimeout(saveTimer); saveTimer=setTimeout(()=>{
      localStorage.setItem(STORAGE_KEY,JSON.stringify(serialize())); $('saveState').textContent='Rascunho salvo';
    },250);
  }
  form.addEventListener('input',saveDraft); form.addEventListener('change',saveDraft);
  try{ const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); if(saved) restore(saved); }catch{}
  if(!$('dataRelatorio').value) $('dataRelatorio').value=formatDateInput(new Date());

  $('btnClear').addEventListener('click',()=>{
    if(!confirm('Limpar todos os campos deste relatório?')) return;
    form.reset(); localStorage.removeItem(STORAGE_KEY); $('dataRelatorio').value=formatDateInput(new Date()); restore({}); showStep(1);
  });

  window.RelatorioApp={serialize,showStep};
  showStep(1);

  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
})();
