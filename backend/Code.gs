/**
 * API - Relatório de Viagem
 * Base central SOMENTE: CPF, RG e NOME (+ data técnica de criação).
 * Não armazena Posto/Graduação e não possui endpoint para listar toda a base.
 *
 * Script Properties obrigatórias:
 *   SHEET_ID = ID da planilha Google Sheets
 * Opcional:
 *   SHEET_NAME = CADASTROS
 */
const RV = {
  sheetName: PropertiesService.getScriptProperties().getProperty('SHEET_NAME') || 'CADASTROS'
};

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || '').toLowerCase();
    if (action !== 'lookup') return json_({ok:false,message:'Ação inválida.'});
    const type = String(e.parameter.type || '').toLowerCase();
    const value = String(e.parameter.value || '').trim();
    if (!['cpf','rg','nome'].includes(type)) return json_({ok:false,message:'Tipo de consulta inválido.'});
    if (!value) return json_({ok:false,message:'Informe o valor da consulta.'});
    if (type === 'nome' && normalizeName_(value).length < 5) return json_({ok:false,message:'Digite pelo menos 5 caracteres do nome.'});

    const rows = dataRows_();
    if (type === 'nome') {
      const q = normalizeName_(value);
      const results = rows.filter(r => normalizeName_(r.nome).startsWith(q)).slice(0,10).map(publicRow_);
      return json_({ok:true,results:results});
    }
    const q = type === 'cpf' ? digits_(value) : normalizeRg_(value);
    const hit = rows.find(r => (type === 'cpf' ? digits_(r.cpf) : normalizeRg_(r.rg)) === q);
    if (!hit) return json_({ok:false,message:'Cadastro não localizado.'});
    return json_({ok:true,data:publicRow_(hit)});
  } catch (err) {
    console.error(err);
    return json_({ok:false,message:'Erro interno na consulta.'});
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const p = (e && e.parameter) || {};
    if (String(p.action || '').toLowerCase() !== 'save') return json_({ok:false,message:'Ação inválida.'});
    const cpf = digits_(p.cpf);
    const rg = normalizeRg_(p.rg);
    const nome = cleanName_(p.nome);
    if (!isValidCpf_(cpf)) return json_({ok:false,message:'CPF inválido.'});
    if (rg.length < 3 || rg.length > 20) return json_({ok:false,message:'RG inválido.'});
    if (nome.length < 3 || nome.length > 100) return json_({ok:false,message:'Nome inválido.'});

    const rows = dataRows_();
    const sameCpf = rows.find(r => digits_(r.cpf) === cpf);
    const sameRg = rows.find(r => normalizeRg_(r.rg) === rg);
    if (sameCpf || sameRg) {
      const hit = sameCpf || sameRg;
      const exact = digits_(hit.cpf)===cpf && normalizeRg_(hit.rg)===rg && normalizeName_(hit.nome)===normalizeName_(nome);
      if (exact) return json_({ok:true,message:'Cadastro já existente.',data:publicRow_(hit)});
      return json_({ok:false,message:'CPF ou RG já está associado a outro cadastro. Nenhum dado foi sobrescrito.'});
    }

    const sh = sheet_();
    sh.appendRow([cpf, rg, nome, new Date()]);
    return json_({ok:true,message:'Cadastro salvo com sucesso.',data:{cpf:cpf,rg:rg,nome:nome}});
  } catch (err) {
    console.error(err);
    return json_({ok:false,message:'Erro interno ao salvar cadastro.'});
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function sheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('SHEET_ID não configurado.');
  const ss = SpreadsheetApp.openById(id);
  let sh = ss.getSheetByName(RV.sheetName);
  if (!sh) {
    sh = ss.insertSheet(RV.sheetName);
    sh.getRange(1,1,1,4).setValues([['CPF','RG','NOME','CRIADO_EM']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function dataRows_() {
  const sh=sheet_(); const last=sh.getLastRow(); if(last<2)return[];
  return sh.getRange(2,1,last-1,4).getDisplayValues().map(r=>({cpf:r[0],rg:r[1],nome:r[2],criadoEm:r[3]}));
}
function publicRow_(r){ return {cpf:digits_(r.cpf),rg:String(r.rg||''),nome:String(r.nome||'')}; }
function digits_(v){ return String(v||'').replace(/\D/g,'').slice(0,11); }
function normalizeRg_(v){ return String(v||'').toUpperCase().replace(/[^0-9A-Z]/g,'').slice(0,20); }
function cleanName_(v){ return String(v||'').replace(/\s+/g,' ').trim().toUpperCase(); }
function normalizeName_(v){ return cleanName_(v).normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function isValidCpf_(cpf){
  cpf=digits_(cpf); if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))return false;
  for(let t=9;t<11;t++){let sum=0;for(let i=0;i<t;i++)sum+=Number(cpf[i])*(t+1-i);let d=(sum*10)%11;if(d===10)d=0;if(d!==Number(cpf[t]))return false;} return true;
}
function json_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
