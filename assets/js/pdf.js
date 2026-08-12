(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const fmtDate=v=>{if(!v)return'';const [y,m,d]=String(v).split('-');return y&&m&&d?`${d}/${m}/${y}`:''};
  const clean=s=>String(s||'').trim();
  const checked=(arr,v)=>Array.isArray(arr)&&arr.includes(v);

  // Helvetica padrão do PDF-Lib usa WinAnsi. Normalizamos símbolos comuns de celular
  // e descartamos caracteres que não podem ser codificados, evitando falhas no Android.
  function pdfSafe(value){
    return clean(value)
      .normalize('NFC')
      .replace(/[⁰]/g,'º')
      .replace(/[¹]/g,'1').replace(/[²]/g,'2').replace(/[³]/g,'3')
      .replace(/[⁴]/g,'4').replace(/[⁵]/g,'5').replace(/[⁶]/g,'6').replace(/[⁷]/g,'7').replace(/[⁸]/g,'8').replace(/[⁹]/g,'9')
      .replace(/[“”„]/g,'"').replace(/[‘’]/g,"'")
      .replace(/[–—]/g,'-').replace(/…/g,'...')
      .replace(/[\u0000-\u001F\u007F]/g,' ')
      .replace(/[^\x20-\x7E\xA0-\xFF\n]/g,'?');
  }

  function wrapText(text,font,size,maxWidth,maxLines){
    const words=pdfSafe(text).split(/\s+/).filter(Boolean); const lines=[]; let line='';
    for(const word0 of words){
      let word=word0;
      while(font.widthOfTextAtSize(word,size)>maxWidth && word.length>1){
        let cut=word.length-1;
        while(cut>1 && font.widthOfTextAtSize(word.slice(0,cut)+'-',size)>maxWidth) cut--;
        const part=word.slice(0,cut)+'-';
        const rest=word.slice(cut);
        if(line){lines.push(line);line='';if(lines.length>=maxLines)return lines.slice(0,maxLines);}
        lines.push(part); if(lines.length>=maxLines)return lines.slice(0,maxLines);
        word=rest;
      }
      const trial=line?`${line} ${word}`:word;
      if(font.widthOfTextAtSize(trial,size)<=maxWidth) line=trial;
      else { if(line) lines.push(line); line=word; if(lines.length>=maxLines) break; }
    }
    if(lines.length<maxLines&&line) lines.push(line);
    return lines.slice(0,maxLines);
  }
  function drawText(page,font,text,x,y,size=7,maxWidth){
    text=pdfSafe(text); if(!text)return;
    if(maxWidth){ while(size>5.2&&font.widthOfTextAtSize(text,size)>maxWidth) size-=.25; }
    page.drawText(text,{x,y,size,font,maxWidth});
  }
  function drawWrapped(page,font,text,x,y,maxWidth,maxLines,size=7,leading=8){
    wrapText(text,font,size,maxWidth,maxLines).forEach((line,i)=>page.drawText(line,{x,y:y-i*leading,size,font}));
  }
  function drawX(page,x,y,size=5){
    page.drawLine({start:{x,y},end:{x:x+size,y:y+size},thickness:.9});
    page.drawLine({start:{x,y:y+size},end:{x:x+size,y},thickness:.9});
  }

  async function buildPdf(){
    if(!window.PDFLib) throw new Error('Biblioteca de PDF não carregou. Verifique sua conexão e tente novamente.');
    const data=window.RelatorioApp.serialize();
    const template=await fetch('assets/pdf/relatorio-viagem-template.pdf',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Template do relatório não encontrado.');return r.arrayBuffer()});
    const doc=await PDFLib.PDFDocument.load(template); const page=doc.getPages()[0]; const font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);

    // Identificação
    drawText(page,font,data.nome,92,660.5,7.2,400);
    drawText(page,font,data.rg,79,649.5,7.2,50);
    drawText(page,font,data.posto,188,649.5,7.2,70);
    drawText(page,font,data.cpf,317,649.5,7.2,68);
    drawText(page,font,data.opm,431,649.5,7.2,62);
    // Portaria / diária
    drawText(page,font,data.portaria,132,638.5,7.1,55);
    drawText(page,font,fmtDate(data.dataPortaria),263,638.5,7.1,80);
    drawText(page,font,data.valor,441,638.5,7.1,52);
    drawText(page,font,data.origem,92,627.5,7.1,92);
    drawText(page,font,data.destino,237,627.5,7.1,146);
    drawText(page,font,data.diarias,441,627.5,7.1,52);

    // Checkboxes viagem
    if(data.realizada==='sim') drawX(page,64.5,605);
    if(data.realizada==='nao') drawX(page,64.5,594);
    if(data.meio==='veiculo') drawX(page,305.5,605);
    if(data.meio==='passagens') drawX(page,305.5,594);
    if(data.meio==='outros') drawX(page,305.5,583);

    // Período
    if(data.periodoTipo==='portaria') drawX(page,62,558.5);
    if(data.periodoTipo==='outro') {
      drawX(page,62,547.5);
      drawText(page,font,fmtDate(data.periodoDe),113,549.5,6.2,49);
      drawText(page,font,fmtDate(data.periodoAte),204,549.5,6.2,50);
    }

    // Campos longos: início abaixo do título, dentro das faixas amarelas.
    drawWrapped(page,font,data.objetivo,60,517.5,455,4,6.7,7.3);
    drawWrapped(page,font,data.atividades,60,474.5,455,7,6.7,7.3);

    // Anexos
    if(checked(data.anexos,'bilhetes')) drawX(page,65,426.5);
    if(checked(data.anexos,'certificado')) drawX(page,65,416.5);
    if(checked(data.anexos,'deposito')) drawX(page,65,405);
    if(checked(data.anexos,'outros')) {
      drawX(page,65,394.5);
      drawText(page,font,data.outrosEspecificar,189,395.5,6.2,300);
    }
    drawWrapped(page,font,data.observacoes,60,370,455,12,6.7,7.3);

    // Local e data na faixa amarela; assinatura permanece em branco.
    drawText(page,font,data.local,64.0,290.5,7,120);
    drawText(page,font,fmtDate(data.dataRelatorio),241.0,290.5,6.4,49);

    return await doc.save();
  }

  function fileName(){
    const d=window.RelatorioApp.serialize();
    const nome=pdfSafe(d.nome).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,60)||'MILITAR';
    return `relatorio_de_viagem-${nome}.pdf`;
  }
  let previewUrl='';
  const mobilePdfFlow=()=>window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;

  function preparePreviewTab(){
    const tab=window.open('about:blank','_blank');
    if(!tab) return null;
    try{
      tab.document.open();
      tab.document.write('<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Pré-visualização do PDF</title></head><body style=\"font-family:system-ui;padding:24px;color:#17212b\"><p id=\"status\">Gerando pré-visualização do PDF...</p><p id=\"fallback\" hidden><a id=\"openPdf\" style=\"display:inline-block;padding:14px 18px;border-radius:10px;background:#0b4f8a;color:white;text-decoration:none;font-weight:700\">Abrir PDF</a></p></body></html>');
      tab.document.close();
    }catch(_){}
    return tab;
  }

  $('previewPdf').onclick=async()=>{
    let previewTab=null;
    try{
      if(mobilePdfFlow()) previewTab=preparePreviewTab();
      const bytes=await buildPdf();
      if(previewUrl)URL.revokeObjectURL(previewUrl);
      previewUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
      if(mobilePdfFlow()){
        if(previewTab){
          try{
            // Primeiro tenta abrir diretamente no visualizador nativo do navegador.
            previewTab.location.href=previewUrl;
            // Se o Android mantiver about:blank, apresenta um link real para o usuário tocar.
            setTimeout(()=>{
              try{
                if(previewTab && !previewTab.closed && previewTab.location.href==='about:blank'){
                  const status=previewTab.document.getElementById('status');
                  const fallback=previewTab.document.getElementById('fallback');
                  const link=previewTab.document.getElementById('openPdf');
                  if(status) status.textContent='PDF pronto.';
                  if(link){link.href=previewUrl;link.target='_self';}
                  if(fallback) fallback.hidden=false;
                }
              }catch(_){ /* Navegou para o visualizador: sucesso. */ }
            },700);
          }catch(_){
            try{
              const link=previewTab.document.getElementById('openPdf');
              const fallback=previewTab.document.getElementById('fallback');
              const status=previewTab.document.getElementById('status');
              if(status) status.textContent='PDF pronto.';
              if(link){link.href=previewUrl;link.target='_self';}
              if(fallback) fallback.hidden=false;
            }catch(__){}
          }
        } else {
          const a=document.createElement('a');a.href=previewUrl;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
        }
        setTimeout(()=>{ if(previewUrl){ URL.revokeObjectURL(previewUrl); previewUrl=''; } },600000);
      } else {
        $('pdfFrame').src=previewUrl;
        $('previewDialog').showModal();
      }
    }catch(e){
      try{
        if(previewTab && !previewTab.closed){
          const status=previewTab.document.getElementById('status');
          if(status) status.textContent=e.message||'Não foi possível gerar a pré-visualização.';
        }
      }catch(_){}
      if(!previewTab) alert(e.message||'Não foi possível gerar a pré-visualização.');
    }
  };
  $('downloadPdf').onclick=async()=>{
    try{const bytes=await buildPdf();const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=fileName();a.rel='noopener';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(e){alert(e.message||'Não foi possível gerar o PDF.')}
  };
  $('closePreview').onclick=()=>$('previewDialog').close();
})();
