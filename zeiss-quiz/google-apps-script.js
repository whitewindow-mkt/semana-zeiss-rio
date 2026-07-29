/**
 * Google Apps Script Web App - Webhook da LP Semana Zeiss (bandeira ZEISS)
 *
 * Faz duas coisas quando o formulário é enviado:
 *   1. grava o lead na planilha
 *   2. manda o evento Lead para o Meta pela API de Conversões
 *
 * Como instalar:
 * 1. Crie uma planilha no Google Sheets.
 * 2. Acesse Extensões > Apps Script.
 * 3. Delete qualquer código existente e cole este script.
 * 4. Salve e clique em "Implantar" (Deploy) > "Nova implantação" (New deployment).
 * 5. Selecione o tipo "App da Web" (Web App).
 * 6. Em "Executar como", selecione "Eu" (Seu e-mail).
 * 7. Em "Quem tem acesso", selecione "Qualquer pessoa" (Anyone) - Isso é essencial para receber dados públicos.
 * 8. Clique em "Implantar" e conceda as permissões de acesso à sua conta do Google Drive/Planilhas.
 * 9. Copie o "URL do App da Web" gerado e cole no arquivo app.js na constante WEBHOOK_URL.
 *
 * COMO LIGAR A API DE CONVERSÕES (o token NÃO vem escrito aqui):
 * 1. No Gerenciador de Eventos, abra o pixel "Semana Zeiss" > Configurações.
 * 2. Na seção da API de Conversões, clique em "Gerar token de acesso" e copie.
 * 3. Aqui no editor do Apps Script: engrenagem (Configurações do projeto) >
 *    "Propriedades do script" > Adicionar propriedade.
 *      Nome:  META_CAPI_TOKEN
 *      Valor: <cole o token>
 * 4. Salve e faça uma NOVA implantação
 *    (Implantar > Gerenciar implantações > editar > Nova versão).
 *
 * Enquanto a propriedade META_CAPI_TOKEN não existir, o script segue
 * gravando os leads na planilha normalmente e simplesmente não envia nada
 * para o Meta. Nada quebra.
 *
 * O token é credencial: mora só aqui nas propriedades do script, nunca no
 * repositório de código.
 */

var META_PIXEL_ID = '2514969079016818';
var META_BRAND = 'ZEISS';
var META_SOURCE_URL = 'https://semanazeissrio.com.br/zeiss-cupom/';
var META_API_VERSION = 'v21.0';

function doPost(e) {
  var postData = null;

  try {
    // Recupera os parâmetros recebidos (dados JSON enviados)
    postData = JSON.parse(e.postData.contents);

    // Abre a planilha ativa onde o script está rodando
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Se a planilha estiver vazia, cria o cabeçalho das colunas automaticamente
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Data/Hora",
        "Nome Completo",
        "DDI/Pais",
        "WhatsApp",
        "E-mail",
        "Unidade/Loja Selecionada",
        "Campanha/Origem"
      ]);

      // Formata a linha de cabeçalho (em negrito)
      sheet.getRange("A1:G1").setFontWeight("bold").setBackground("#0050ff").setFontColor("#ffffff");
    }

    // Monta a linha com as informações fornecidas do lead
    var rowData = [
      postData.timestamp ? new Date(postData.timestamp) : new Date(),
      postData.nome || "",
      postData.paisCodigo || "+55",
      postData.whatsapp || "",
      postData.email || "",
      postData.loja || "",
      postData.origem || "Semana Zeiss"
    ];

    // Adiciona o lead como uma nova linha na planilha
    sheet.appendRow(rowData);

  } catch (err) {
    // Falha ao gravar na planilha: devolve erro e não tenta o Meta
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Envio para o Meta em bloco separado: se a API falhar, o lead já está
  // salvo na planilha e o visitante já foi redirecionado. Problema de
  // mensuração nunca pode derrubar a captação.
  try {
    sendMetaLead(postData);
  } catch (metaErr) {
    console.error('Falha ao enviar evento para o Meta: ' + metaErr);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Lead cadastrado com sucesso!"
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Manda o evento Lead para o Meta pela API de Conversões.
 * Só roda se o token estiver configurado nas propriedades do script.
 */
function sendMetaLead(lead) {
  var token = PropertiesService.getScriptProperties().getProperty('META_CAPI_TOKEN');
  if (!token) return; // API de Conversões ainda não configurada

  var userData = {};

  if (lead.email) {
    userData.em = [sha256(String(lead.email).trim().toLowerCase())];
  }

  if (lead.whatsapp) {
    var ddi = lead.paisCodigo ? String(lead.paisCodigo) : '+55';
    var phone = (ddi + String(lead.whatsapp)).replace(/[^0-9]/g, '');
    if (phone) userData.ph = [sha256(phone)];
  }

  if (lead.nome) {
    var parts = String(lead.nome).trim().toLowerCase().split(/\s+/);
    userData.fn = [sha256(parts[0])];
    if (parts.length > 1) userData.ln = [sha256(parts[parts.length - 1])];
  }

  // Estes três NÃO são hasheados: vão em texto puro. São coletados no
  // navegador pelo app.js porque o servidor não tem acesso a eles, e são os
  // que mais elevam a correspondência. fbc carrega o clique no anúncio.
  if (lead.userAgent) userData.client_user_agent = String(lead.userAgent);
  if (lead.fbp) userData.fbp = String(lead.fbp);
  if (lead.fbc) userData.fbc = String(lead.fbc);

  // Sem nenhum dado de identificação o Meta não consegue casar o evento
  if (!Object.keys(userData).length) return;

  var eventTime = lead.timestamp
    ? Math.floor(new Date(lead.timestamp).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  var event = {
    event_name: 'Lead',
    event_time: eventTime,
    action_source: 'website',
    event_source_url: META_SOURCE_URL,
    user_data: userData,
    custom_data: {
      content_name: 'Pre-cadastro Semana ZEISS',
      content_category: META_BRAND
    }
  };

  // Mesmo id que o navegador usa, para o Meta contar a conversão uma vez só
  if (lead.eventId) event.event_id = String(lead.eventId);
  if (lead.loja) event.custom_data.content_ids = [String(lead.loja)];

  var url = 'https://graph.facebook.com/' + META_API_VERSION + '/' + META_PIXEL_ID + '/events';

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ data: [event], access_token: token }),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    console.error('Meta CAPI respondeu ' + code + ': ' + response.getContentText());
  }
}

/**
 * SHA-256 em hexadecimal, formato que o Meta exige para os dados pessoais.
 */
function sha256(value) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8
  );
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    if (b < 0) b += 256;
    var part = b.toString(16);
    hex += (part.length === 1 ? '0' : '') + part;
  }
  return hex;
}
