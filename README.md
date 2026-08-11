# Relatório de Viagem - P4 / 20º BPM

Aplicação web mobile-first para preenchimento do Relatório de Viagem e geração local do PDF oficial.

## Escopo da V1

- 6 etapas de preenchimento responsivo.
- Rascunho salvo automaticamente no aparelho.
- Posto/Graduação sempre manual.
- Geração e download do PDF usando `assets/pdf/relatorio-viagem-template.pdf` como documento-mestre.
- Pré-visualização do PDF.
- PWA / Service Worker para os arquivos principais.
- Integração preparada para API Google Apps Script.
- API armazena somente CPF, RG e NOME; `CRIADO_EM` é metadado técnico.
- A API não possui operação para listar toda a base e não sobrescreve conflito de CPF/RG.

## Publicar no GitHub Pages

1. Crie um repositório, sugestão: `relatorio-viagem`.
2. Envie todo o conteúdo desta pasta para a raiz do repositório.
3. Em **Settings > Pages**, publique a branch principal (`main`) pela pasta `/root`.
4. Aguarde a URL do GitHub Pages e teste primeiro no celular.

## Configurar a API

1. Crie uma planilha Google Sheets vazia para a base cadastral.
2. Crie um projeto Google Apps Script e cole `backend/Code.gs`.
3. Em **Project Settings > Script Properties**, crie:
   - `SHEET_ID`: ID da planilha.
   - `SHEET_NAME`: `CADASTROS` (opcional).
4. Implante como **Web App**.
5. Cole a URL terminada em `/exec` em `assets/js/config.js`.
6. Faça nova publicação do site no GitHub.

## Observação sobre PDF-Lib

A V1 carrega PDF-Lib via CDN. O Service Worker pode armazená-lo após a primeira utilização, mas uma etapa futura pode trazer a biblioteca para dentro do repositório para eliminar essa dependência externa.

## Regra permanente da base

A base automática contém apenas: **CPF, RG e Nome**. Posto/Graduação não é persistido para evitar desatualização após promoção.


## V1.3

- Pré-visualização de PDF adaptada para mobile (abre em nova aba/visualizador nativo).
- Ajuste fino de Local e Data no PDF.
- Instalação PWA com convite temporário no Android e instrução equivalente no iOS.
- Ícones 192/512/maskable e Apple Touch Icon.
- Cache atualizado para `relatorio-viagem-v1.3.0`.
