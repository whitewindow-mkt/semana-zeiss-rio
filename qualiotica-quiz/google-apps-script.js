/**
 * Google Apps Script Web App - Webhook para coletar leads da LP Semana Zeiss
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
 */

function doPost(e) {
  try {
    // Recupera os parâmetros recebidos (dados JSON enviados)
    var postData = JSON.parse(e.postData.contents);
    
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
    
    // Retorna resposta de sucesso
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Lead cadastrado com sucesso!"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    // Retorna erro caso ocorra alguma falha na leitura dos dados
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
