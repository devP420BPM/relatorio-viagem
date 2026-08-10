(() => {
  const $=id=>document.getElementById(id);
  const fmtDate=v=>{if(!v)return'';const [y,m,d]=v.split('-');return `${d}/${m}/${y}`};
  const clean=s=>String(s||'').trim();
  const checked=(arr,v)=>Array.isArray(arr)&&arr.includes(v);

  function wrapText(text,font,size,maxWidth,maxLines){
    const words=clean(text).split(/\s+/).filter(Boolean); const lines=[]; let line='';
    for(const word of words){
      const trial=line?`${line} ${word}`:word;
      if(font.widthOfTextAtSize(trial,size)<=maxWidth) line=trial;
      else { if(line) lines.push(line); line=word; if(lines.length>=maxLines) break; }
    }
    if(lines.length<maxLines&&line) lines.push(line);
    if(lines.length===maxLines && words.length && font.widthOfTextAtSize(lines[maxLines-1],size)>maxWidth) lines[maxLines-1]=lines[maxLines-1].slice(0,-1)+'…';
    return lines.slice(0,maxLines);
  }
  function drawText(page,font,text,x,y,size=7,maxWidth){
    text=clean(text); if(!text)return;
    if(maxWidth){ while(size>5.5&&font.widthOfTextAtSize(text,size)>maxWidth) size-=.25; }
    page.drawText(text,{x,y,size,font});
  }
  function drawWrapped(page,font,text,x,y,maxWidth,maxLines,size=7,leading=8){
    wrapText(text,font,size,maxWidth,maxLines).forEach((line,i)=>page.drawText(line,{x,y:y-i*leading,size,font}));
  }
  function drawX(page,x,y){
    page.drawLine({start:{x,y},end:{x:x+6,y:y+6},thickness:1.2});
    page.drawLine({start:{x,y:y+6},end:{x:x+6,y},thickness:1.2});
  }

  async function buildPdf(){
    if(!window.PDFLib) throw new Error('Biblioteca de PDF não carregou. Verifique sua conexão e tente novamente.');
    const data=window.RelatorioApp.serialize();
    const template=await fetch('assets/pdf/relatorio-viagem-template.pdf').then(r=>{if(!r.ok)throw new Error('Template do relatório não encontrado.');return r.arrayBuffer()});
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

    // Checkboxes viagem - coordenadas dentro das caixas do template
    if(data.realizada==='sim') drawX(page,63,611.5);
    if(data.realizada==='nao') drawX(page,63,600.5);
    if(data.meio==='veiculo') drawX(page,306,611.5);
    if(data.meio==='passagens') drawX(page,306,600.5);
    if(data.meio==='outros') drawX(page,306,589.5);

    // Período
    if(data.periodoTipo==='portaria') drawX(page,61,570.5);
    if(data.periodoTipo==='outro') {
      drawX(page,61,559.5);
      drawText(page,font,fmtDate(data.periodoDe),113,558.8,6.8,49);
      drawText(page,font,fmtDate(data.periodoAte),204,558.8,6.8,50);
    }

    // Campos longos
    drawWrapped(page,font,data.objetivo,52,535.5,390,5,7,8.2);
    drawWrapped(page,font,data.atividades,52,477.5,390,9,7,8.2);

    // Anexos
    if(checked(data.anexos,'bilhetes')) drawX(page,63,387.5);
    if(checked(data.anexos,'certificado')) drawX(page,63,376.5);
    if(checked(data.anexos,'deposito')) drawX(page,63,365.5);
    if(checked(data.anexos,'outros')) {
      drawX(page,63,354.5);
      drawText(page,font,data.outrosEspecificar,189,354.5,6.7,300);
    }
    drawWrapped(page,font,data.observacoes,52,332.5,390,12,7,8.1);

    // Local e data; assinatura permanece em branco
    drawText(page,font,data.local,52,267.5,7.1,109);
    drawText(page,font,fmtDate(data.dataRelatorio),194,267.5,7.1,46);

    return await doc.save();
  }

  function fileName(){
    const d=window.RelatorioApp.serialize(); const nome=clean(d.nome).toUpperCase().replace(/[^A-Z0-9À-Ü]+/g,'_').replace(/^_|_$/g,'').slice(0,45)||'MILITAR';
    const date=(d.dataRelatorio||new Date().toISOString().slice(0,10)).replaceAll('-','');
    return `RELATORIO_VIAGEM_${nome}_${date}.pdf`;
  }
  let previewUrl='';
  $('previewPdf').onclick=async()=>{
    try{const bytes=await buildPdf();if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));$('pdfFrame').src=previewUrl;$('previewDialog').showModal();}catch(e){alert(e.message)}
  };
  $('downloadPdf').onclick=async()=>{
    try{const bytes=await buildPdf();const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=fileName();document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(e){alert(e.message)}
  };
  $('closePreview').onclick=()=>$('previewDialog').close();
})();
