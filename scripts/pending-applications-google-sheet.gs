function doPost(event) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty("SYNC_SECRET");
    const spreadsheetId = properties.getProperty("SPREADSHEET_ID");

    if (!expectedSecret || !spreadsheetId) {
      throw new Error("Missing required script properties.");
    }

    const payload = JSON.parse(event.postData.contents);
    if (!payload.secret || payload.secret !== expectedSecret) {
      return jsonResponse({ success: false, message: "Unauthorized request." });
    }
    const sheetName = payload.sheetName || properties.getProperty("SHEET_NAME") || "Pending Applications";
    if (!["Pending Applications", "Referral Codes"].includes(sheetName)) {
      throw new Error("Invalid destination sheet.");
    }
    if (!Array.isArray(payload.values) || payload.values.length === 0) {
      throw new Error("Invalid sheet values.");
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
      const values = payload.values.map((row) =>
        row.map((value) => {
          const text = String(value == null ? "" : value);
          return /^[=+\-@]/.test(text) ? "'" + text : text;
        }),
      );

      sheet.clearContents();
      sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ success: true, syncedCount: payload.values.length - 1 });
  } catch (error) {
    console.error("Pending applications sheet update failed:", error);
    return jsonResponse({ success: false, message: "Sheet update failed." });
  }
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
