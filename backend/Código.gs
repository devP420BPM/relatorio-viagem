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
  sheetName: PropertiesService.getScriptProperties().getProperty('SHEET_NAME') || 'CADASTROS',
  maxName: 100,
  maxRg: 20
};

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = safeToken_(p.action, 16).toLowerCase();
    if (action !== 'lookup') return json_({ok:false,message:'Ação inválida.'});
    const type = safeToken_(p.type, 10).toLowerCase();
    const rawValue = safeInput_(p.value, 120);
    if (!['cpf','rg','nome'].includes(type)) return json_({ok:false,message:'Tipo de consulta inválido.'});
    if (!rawValue) return json_({ok:false,message:'Informe o valor da consulta.'});

    let query;
    if (type === 'cpf') {
      query = digits_(rawValue);
      if (!isValidCpf_(query)) return json_({ok:false,message:'CPF inválido.'});
    } else if (type === 'rg') {
      query = normalizeRg_(rawValue);
      if (query.length < 3) return json_({ok:false,message:'RG inválido.'});
    } else {
      query = normalizeName_(rawValue);
      if (query.length < 5) return json_({ok:false,message:'Digite pelo menos 5 caracteres do nome.'});
    }

    const rows = dataRows_();
    if (type === 'nome') {
      const exactHits = rows.filter(r => normalizeName_(r.nome) === query);
      if (exactHits.length === 1) return json_({ok:true,data:publicRow_(exactHits[0]),exact:true});
      if (exactHits.length > 1) return json_({ok:true,results:exactHits.slice(0,8).map(publicRow_),exact:false});
      const results = rows.filter(r => normalizeName_(r.nome).startsWith(query)).slice(0,8).map(publicRow_);
      return json_({ok:true,results:results,exact:false});
    }
    const hit = rows.find(r => (type === 'cpf' ? digits_(r.cpf) : normalizeRg_(r.rg)) === query);
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
    if (safeToken_(p.action,16).toLowerCase() !== 'save') return json_({ok:false,message:'Ação inválida.'});
    const cpf = digits_(p.cpf);
    const rg = normalizeRg_(safeInput_(p.rg,RV.maxRg));
    const nome = cleanName_(safeInput_(p.nome,RV.maxName));
    if (!isValidCpf_(cpf)) return json_({ok:false,message:'CPF inválido.'});
    if (rg.length < 3 || rg.length > RV.maxRg) return json_({ok:false,message:'RG inválido.'});
    if (nome.length < 3 || nome.length > RV.maxName || /^[=+\-@]/.test(nome)) return json_({ok:false,message:'Nome inválido.'});

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
    // Força CPF e RG como texto para preservar zeros à esquerda no Google Sheets.
    const targetRow = sh.getLastRow() + 1;
    sh.getRange(targetRow,1,1,3).setNumberFormat('@');
    sh.getRange(targetRow,1,1,4).setValues([[cpf, rg, nome, new Date()]]);
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
function publicRow_(r){ return {cpf:digits_(r.cpf),rg:String(r.rg||'').slice(0,RV.maxRg),nome:String(r.nome||'').slice(0,RV.maxName)}; }
function safeInput_(v,max){ return String(v||'').normalize('NFC').replace(/[\u0000-\u001F\u007F<>`]/g,' ').replace(/\s+/g,' ').trim().slice(0,max); }
function safeToken_(v,max){ return String(v||'').replace(/[^A-Za-z]/g,'').slice(0,max); }
function digits_(v){ return String(v||'').replace(/\D/g,'').slice(0,11); }
function normalizeRg_(v){ return String(v||'').toUpperCase().replace(/[^0-9A-Z]/g,'').slice(0,RV.maxRg); }
function cleanName_(v){
  return safeInput_(v,RV.maxName)
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' .-]/g,'')
    .replace(/\s+/g,' ')
    .trim()
    .toUpperCase();
}
function normalizeName_(v){ return cleanName_(v).normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function isValidCpf_(cpf){
  cpf=digits_(cpf); if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))return false;
  for(let t=9;t<11;t++){let sum=0;for(let i=0;i<t;i++)sum+=Number(cpf[i])*(t+1-i);let d=(sum*10)%11;if(d===10)d=0;if(d!==Number(cpf[t]))return false;} return true;
}
function json_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
