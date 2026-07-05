// Mr.Rahul Script ERP - Google Apps Script Backend
// Spreadsheet ID: 1kuAkWmc1MdIY55SyuBu285qvic6f5m_1N19M3DwBPko

function getSpreadsheet() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch(e) {}
  if (!ss) {
    try { ss = SpreadsheetApp.openById("1kuAkWmc1MdIY55SyuBu285qvic6f5m_1N19M3DwBPko"); } catch(e) {}
  }
  return ss;
}

function doGet(e) {
  e = e || { parameter: {} };
  var action = e.parameter.action;
  var sheet = getSpreadsheet();
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Spreadsheet not accessible." })).setMimeType(ContentService.MimeType.JSON);
  }
  try {
    initDatabase(sheet);
    if (action === "getAllData") {
      var requestedSheets = e.parameter.sheets ? e.parameter.sheets.split(",") : null;
      var data = { success: true };
      var sheetsToRead = [
        "Parties", "Products", "Transactions", "BankAccounts", "Users", 
        "Notifications", "CompanyProfile", "Expenses", "Quotations", 
        "PurchaseOrders", "DeliveryChallans", "ActivityLog"
      ];
      for (var i = 0; i < sheetsToRead.length; i++) {
        var sName = sheetsToRead[i];
        var clientKey = sName.charAt(0).toLowerCase() + sName.slice(1);
        if (sName === "BankAccounts") clientKey = "bankAccounts";
        if (sName === "CompanyProfile") clientKey = "companyProfile";
        if (sName === "PurchaseOrders") clientKey = "purchaseOrders";
        if (sName === "DeliveryChallans") clientKey = "deliveryChallans";
        if (sName === "ActivityLog") clientKey = "activityLog";
        
        if (!requestedSheets || requestedSheets.indexOf(sName) !== -1) {
          data[clientKey] = readSheetData(sheet, sName);
        }
      }
      return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "getDashboardStats") {
      return ContentService.createTextOutput(JSON.stringify(getDashboardStats(sheet))).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "getReport") {
      var reportType = e.parameter.type;
      var dateFrom = e.parameter.dateFrom;
      var dateTo = e.parameter.dateTo;
      var partyId = e.parameter.partyId;
      return ContentService.createTextOutput(JSON.stringify(generateReport(sheet, reportType, dateFrom, dateTo, partyId))).setMimeType(ContentService.MimeType.JSON);
    }
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle("Mr.Rahul ERP")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  e = e || { parameter: {}, postData: { contents: "{}" } };
  var action = e.parameter.action;
  var sheet = getSpreadsheet();
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Spreadsheet not accessible." })).setMimeType(ContentService.MimeType.JSON);
  }
  try {
    var payload = JSON.parse(e.postData.contents);

    // ---- AUTH ----
    if (action === "login") {
      var users = readSheetData(sheet, "Users");
      var found = users.filter(function(u) {
        return u.email.toLowerCase() === payload.email.toLowerCase() && u.passwordHash === payload.passwordHash && u.status === "Active";
      });
      if (found.length > 0) {
        logActivityInternal(sheet, found[0].id, found[0].name, "Login", "Auth", "User logged in");
        return ContentService.createTextOutput(JSON.stringify({ success: true, user: found[0] })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Invalid credentials or account inactive" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "requestPasswordReset") {
      var users = readSheetData(sheet, "Users");
      var found = users.filter(function(u) {
        return u.email.toLowerCase() === payload.email.toLowerCase();
      });
      if (found.length > 0) {
        var user = found[0];
        // Create a notification for Admin
        var notifId = "NOT" + Date.now();
        var notification = {
          id: notifId,
          message: "Password reset requested for " + user.name + " (" + user.email + ")",
          type: "PasswordReset|" + user.id,
          date: new Date().toISOString(),
          read: "false"
        };
        upsertRowInSheet(sheet, "Notifications", notification, "id");
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Request submitted successfully. Please wait for Admin approval." })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Email address not found in system." })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "approvePasswordReset") {
      var notificationId = payload.notificationId;
      var userId = payload.userId;
      var appUrl = payload.appUrl || "";
      
      var users = readSheetData(sheet, "Users");
      var foundUsers = users.filter(function(u) {
        return u.id === userId;
      });
      
      if (foundUsers.length > 0) {
        var user = foundUsers[0];
        
        // Generate temporary password
        var randomDigits = Math.floor(10000 + Math.random() * 90000);
        var tempPassword = "Temp" + randomDigits;
        
        // Update user password hash
        user.passwordHash = simpleHash(tempPassword);
        upsertRowInSheet(sheet, "Users", user, "id");
        
        // Mark notification as read
        if (notificationId) {
          var notifs = readSheetData(sheet, "Notifications");
          var foundNotif = notifs.filter(function(n) { return n.id === notificationId; });
          if (foundNotif.length > 0) {
            var notif = foundNotif[0];
            notif.read = "true";
            upsertRowInSheet(sheet, "Notifications", notif, "id");
          }
        }
        
        // Get company profile for logo/name
        var profile = {};
        try {
          var profiles = readSheetData(sheet, "CompanyProfile");
          if (profiles.length > 0) profile = profiles[0];
        } catch(e) {}
        
        var companyName = profile.companyName || "Mr.Rahul ERP";
        var companyLogo = profile.companyLogo || ""; // Base64 or URL
        
        // Send email with premium HTML design template
        var emailSubject = "Password Reset Approved - " + companyName;
        var emailBody = getPremiumEmailTemplate(user.name, tempPassword, companyName, companyLogo, appUrl);
        
        try {
          GmailApp.sendEmail(user.email, emailSubject, "", {
            htmlBody: emailBody
          });
        } catch (e) {
          // Log email failure but return success since password was updated
          logActivityInternal(sheet, "System", "Email", "Email Error", "Auth", e.toString());
        }
        
        logActivityInternal(sheet, "System", "Auth", "Approve Reset", "Users", user.email);
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Password reset approved! Temporary password has been emailed to the user." })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "User not found." })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- PARTIES ----
    if (action === "saveParty") {
      upsertRowInSheet(sheet, "Parties", payload, "id");
      logActivityInternal(sheet, payload.enteredBy || "", "", "Save Party", "Parties", payload.name);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "deleteParty") {
      deleteRowFromSheet(sheet, "Parties", payload.id, "id");
      logActivityInternal(sheet, payload.deletedBy || "", "", "Delete Party", "Parties", payload.id);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- PRODUCTS ----
    if (action === "saveProduct") {
      upsertRowInSheet(sheet, "Products", payload, "id");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "deleteProduct") {
      deleteRowFromSheet(sheet, "Products", payload.id, "id");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- INVOICES (SALES) ----
    if (action === "saveInvoice") {
      var txn = payload.invoice || payload;
      rollbackSheetBalances(sheet, txn.id);
      upsertRowInSheet(sheet, "Transactions", txn, "id");
      adjustStock(sheet, payload.items || txn.items || [], "sale");
      adjustBankForInvoice(sheet, txn, "saveInvoice");
      logActivityInternal(sheet, txn.enteredBy || "", "", "Save Invoice", "Sales", txn.voucherNo);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- PURCHASE ----
    if (action === "savePurchase") {
      var txn = payload.purchase || payload;
      rollbackSheetBalances(sheet, txn.id);
      upsertRowInSheet(sheet, "Transactions", txn, "id");
      adjustStock(sheet, payload.items || txn.items || [], "purchase");
      adjustBankForInvoice(sheet, txn, "savePurchase");
      logActivityInternal(sheet, txn.enteredBy || "", "", "Save Purchase", "Purchase", txn.voucherNo);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- RECEIPT ----
    if (action === "saveReceipt") {
      var txn = payload;
      rollbackSheetBalances(sheet, txn.id);
      upsertRowInSheet(sheet, "Transactions", txn, "id");
      var bankSheet = sheet.getSheetByName("BankAccounts");
      if (bankSheet) {
        var bankData = bankSheet.getDataRange().getValues();
        var credit = parseFloat(txn.credit || 0);
        for (var k = 1; k < bankData.length; k++) {
          if ((txn.paymentMode === "Cash" && bankData[k][0] === "BA001") ||
              (txn.paymentMode !== "Cash" && bankData[k][0] === "BA002")) {
            var currBal = parseFloat(bankSheet.getRange(k+1, 8).getValue() || 0);
            bankSheet.getRange(k+1, 8).setValue(currBal + credit);
          }
        }
      }
      if (txn.linkedInvoice) adjustLinkedInvoiceSheet(sheet, txn.linkedInvoice, parseFloat(txn.credit), txn.paymentMode, false);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- PAYMENT (to supplier) ----
    if (action === "savePayment") {
      var txn = payload;
      rollbackSheetBalances(sheet, txn.id);
      upsertRowInSheet(sheet, "Transactions", txn, "id");
      var bankSheet = sheet.getSheetByName("BankAccounts");
      if (bankSheet) {
        var bankData = bankSheet.getDataRange().getValues();
        var debit = parseFloat(txn.debit || 0);
        for (var k = 1; k < bankData.length; k++) {
          if ((txn.paymentMode === "Cash" && bankData[k][0] === "BA001") ||
              (txn.paymentMode !== "Cash" && bankData[k][0] === "BA002")) {
            var currBal = parseFloat(bankSheet.getRange(k+1, 8).getValue() || 0);
            bankSheet.getRange(k+1, 8).setValue(currBal - debit);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- RETURN ----
    if (action === "saveReturn") {
      var txn = payload;
      rollbackSheetBalances(sheet, txn.id);
      upsertRowInSheet(sheet, "Transactions", txn, "id");
      var items = txn.items || [];
      var productsSheet = sheet.getSheetByName("Products");
      var productsData = productsSheet.getDataRange().getValues();
      for (var i = 0; i < items.length; i++) {
        for (var j = 1; j < productsData.length; j++) {
          if (productsData[j][0] === items[i].productId) {
            var currStock = parseFloat(productsData[j][10] || 0);
            var delta = txn.returnType === "Sales" ? items[i].quantity : -items[i].quantity;
            productsSheet.getRange(j+1, 11).setValue(currStock + delta);
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- DELETE TRANSACTION ----
    if (action === "deleteTransaction") {
      rollbackSheetBalances(sheet, payload.id);
      deleteRowFromSheet(sheet, "Transactions", payload.id, "id");
      logActivityInternal(sheet, payload.deletedBy || "", "", "Delete Transaction", "Transactions", payload.id);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- BANKING ----
    if (action === "saveBankingTransaction") {
      var txn = payload;
      rollbackSheetBalances(sheet, txn.id);
      upsertRowInSheet(sheet, "Transactions", txn, "id");
      var bankSheet = sheet.getSheetByName("BankAccounts");
      if (bankSheet) {
        var bankData = bankSheet.getDataRange().getValues();
        var totals = txn.totals || {};
        var type = totals.type;
        var amount = parseFloat(totals.grandTotal || 0);
        for (var k = 1; k < bankData.length; k++) {
          var accId = bankData[k][0];
          var rowIdx = k + 1;
          var currBal = parseFloat(bankSheet.getRange(rowIdx, 8).getValue() || 0);
          if (type === "Deposit") {
            if (accId === "BA001") bankSheet.getRange(rowIdx, 8).setValue(currBal - amount);
            if (accId === "BA002") bankSheet.getRange(rowIdx, 8).setValue(currBal + amount);
          } else if (type === "Withdrawal") {
            if (accId === "BA001") bankSheet.getRange(rowIdx, 8).setValue(currBal + amount);
            if (accId === "BA002") bankSheet.getRange(rowIdx, 8).setValue(currBal - amount);
          } else if (type === "Transfer") {
            if (accId === totals.fromAccountId) bankSheet.getRange(rowIdx, 8).setValue(currBal - amount);
            if (accId === totals.toAccountId) bankSheet.getRange(rowIdx, 8).setValue(currBal + amount);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- BANK ACCOUNTS ----
    if (action === "saveBankAccount") {
      upsertRowInSheet(sheet, "BankAccounts", payload, "id");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "deleteBankAccount") {
      if (payload.id === "BA001") return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Cannot delete Cash account" })).setMimeType(ContentService.MimeType.JSON);
      deleteRowFromSheet(sheet, "BankAccounts", payload.id, "id");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- SECURITY DEPOSIT / REFUND ----
    if (action === "saveSecurityDeposit") {
      var txn = payload;
      rollbackSheetBalances(sheet, txn.id);
      upsertRowInSheet(sheet, "Transactions", txn, "id");
      var bankSheet = sheet.getSheetByName("BankAccounts");
      if (bankSheet) {
        var bankData = bankSheet.getDataRange().getValues();
        var credit = parseFloat(txn.credit || 0);
        for (var k = 1; k < bankData.length; k++) {
          if ((txn.paymentMode === "Cash" && bankData[k][0] === "BA001") ||
              (txn.paymentMode !== "Cash" && bankData[k][0] === "BA002")) {
            var currBal = parseFloat(bankSheet.getRange(k+1, 8).getValue() || 0);
            bankSheet.getRange(k+1, 8).setValue(currBal + credit);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "saveSecurityRefund") {
      var txn = payload;
      rollbackSheetBalances(sheet, txn.id);
      upsertRowInSheet(sheet, "Transactions", txn, "id");
      var bankSheet = sheet.getSheetByName("BankAccounts");
      if (bankSheet) {
        var bankData = bankSheet.getDataRange().getValues();
        var amount = parseFloat(txn.totals && txn.totals.grandTotal || 0);
        for (var k = 1; k < bankData.length; k++) {
          if ((txn.paymentMode === "Cash" && bankData[k][0] === "BA001") ||
              (txn.paymentMode !== "Cash" && bankData[k][0] === "BA002")) {
            var currBal = parseFloat(bankSheet.getRange(k+1, 8).getValue() || 0);
            bankSheet.getRange(k+1, 8).setValue(currBal - amount);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- EXPENSES ----
    if (action === "saveExpense") {
      upsertRowInSheet(sheet, "Expenses", payload, "id");
      var bankSheet = sheet.getSheetByName("BankAccounts");
      if (bankSheet && payload.isNew) {
        var bankData = bankSheet.getDataRange().getValues();
        var amount = parseFloat(payload.amount || 0);
        for (var k = 1; k < bankData.length; k++) {
          if ((payload.paymentMode === "Cash" && bankData[k][0] === "BA001") ||
              (payload.paymentMode !== "Cash" && bankData[k][0] === "BA002")) {
            var currBal = parseFloat(bankSheet.getRange(k+1, 8).getValue() || 0);
            bankSheet.getRange(k+1, 8).setValue(currBal - amount);
          }
        }
      }
      logActivityInternal(sheet, payload.enteredBy || "", "", "Save Expense", "Expenses", payload.category + " - " + payload.amount);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "deleteExpense") {
      var expenses = readSheetData(sheet, "Expenses");
      var exp = null;
      for (var i = 0; i < expenses.length; i++) {
        if (expenses[i].id === payload.id) { exp = expenses[i]; break; }
      }
      if (exp) {
        var bankSheet = sheet.getSheetByName("BankAccounts");
        if (bankSheet) {
          var bankData = bankSheet.getDataRange().getValues();
          var amount = parseFloat(exp.amount || 0);
          for (var k = 1; k < bankData.length; k++) {
            if ((exp.paymentMode === "Cash" && bankData[k][0] === "BA001") ||
                (exp.paymentMode !== "Cash" && bankData[k][0] === "BA002")) {
              var currBal = parseFloat(bankSheet.getRange(k+1, 8).getValue() || 0);
              bankSheet.getRange(k+1, 8).setValue(currBal + amount);
            }
          }
        }
      }
      deleteRowFromSheet(sheet, "Expenses", payload.id, "id");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- QUOTATIONS ----
    if (action === "saveQuotation") {
      upsertRowInSheet(sheet, "Quotations", payload, "id");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "deleteQuotation") {
      deleteRowFromSheet(sheet, "Quotations", payload.id, "id");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "convertQuotationToInvoice") {
      var quot = payload.quotation;
      quot.txnType = "Sale";
      quot.id = payload.newInvoiceId;
      quot.voucherNo = payload.newVoucherNo;
      upsertRowInSheet(sheet, "Transactions", quot, "id");
      var quotSheet = sheet.getSheetByName("Quotations");
      if (quotSheet) {
        var qData = quotSheet.getDataRange().getValues();
        var qHeaders = qData[0];
        var statusIdx = qHeaders.indexOf("status");
        for (var i = 1; i < qData.length; i++) {
          if (qData[i][0] === payload.quotationId) {
            quotSheet.getRange(i+1, statusIdx+1).setValue("Converted");
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- PURCHASE ORDERS ----
    if (action === "savePurchaseOrder") {
      upsertRowInSheet(sheet, "PurchaseOrders", payload, "id");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "deletePurchaseOrder") {
      deleteRowFromSheet(sheet, "PurchaseOrders", payload.id, "id");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- DELIVERY CHALLANS ----
    if (action === "saveDeliveryChallan") {
      upsertRowInSheet(sheet, "DeliveryChallans", payload, "id");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "deleteDeliveryChallan") {
      deleteRowFromSheet(sheet, "DeliveryChallans", payload.id, "id");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- USERS ----
    if (action === "saveUser") {
      upsertRowInSheet(sheet, "Users", payload, "id");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "deleteUser") {
      deleteRowFromSheet(sheet, "Users", payload.id, "id");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "changePassword") {
      var usersSheet = sheet.getSheetByName("Users");
      var uData = usersSheet.getDataRange().getValues();
      var uHeaders = uData[0];
      var hashIdx = uHeaders.indexOf("passwordHash");
      for (var i = 1; i < uData.length; i++) {
        if (uData[i][0] === payload.userId) {
          usersSheet.getRange(i+1, hashIdx+1).setValue(payload.newPasswordHash);
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- SETTINGS ----
    if (action === "saveSettings") {
      var profileSheet = sheet.getSheetByName("CompanyProfile");
      if (!profileSheet) {
        profileSheet = sheet.insertSheet("CompanyProfile");
        profileSheet.appendRow(["key", "value"]);
      }
      var keys = Object.keys(payload);
      var data = profileSheet.getDataRange().getValues();
      for (var ki = 0; ki < keys.length; ki++) {
        var key = keys[ki];
        var val = payload[key];
        var found = false;
        for (var ri = 1; ri < data.length; ri++) {
          if (data[ri][0] === key) {
            profileSheet.getRange(ri+1, 2).setValue(val);
            found = true;
            break;
          }
        }
        if (!found) profileSheet.appendRow([key, val]);
      }
      formatSheetVisuals(profileSheet);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- NOTIFICATIONS ----
    if (action === "saveNotification") {
      upsertRowInSheet(sheet, "Notifications", payload, "id");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "markNotificationRead") {
      var notifSheet = sheet.getSheetByName("Notifications");
      if (notifSheet) {
        var nData = notifSheet.getDataRange().getValues();
        var nHeaders = nData[0];
        var readIdx = nHeaders.indexOf("read");
        for (var i = 1; i < nData.length; i++) {
          if (nData[i][0] === payload.id) {
            notifSheet.getRange(i+1, readIdx+1).setValue(true);
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- ACTIVITY LOG ----
    if (action === "logActivity") {
      logActivityInternal(sheet, payload.userId, payload.userName, payload.action, payload.module, payload.details);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ---- DATABASE MANAGEMENT ----
    if (action === "seedDatabase") {
      seedSheetDatabase(sheet);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Database seeded successfully!" })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "clearDatabase") {
      clearSheetDatabase(sheet);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Database cleared successfully!" })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Unknown action: " + action })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- executeActionFromWebapp for HtmlService sandbox ---
function executeActionFromWebapp(action, payloadJson) {
  try {
    if (action === "getAllData" || action === "getReport" || action === "getDashboardStats") {
      var payload = JSON.parse(payloadJson || "{}");
      var params = Object.assign({ action: action }, payload);
      var e = { parameter: params };
      return JSON.parse(doGet(e).getContent());
    }
    var e = { parameter: { action: action }, postData: { contents: payloadJson } };
    return JSON.parse(doPost(e).getContent());
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function executeGetAction(action, params) {
  try {
    var e = { parameter: Object.assign({ action: action }, params || {}) };
    return JSON.parse(doGet(e).getContent());
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// ===================== HELPERS =====================

function readSheetData(sheet, sheetName) {
  if (!sheet) return [];
  var targetSheet = sheet.getSheetByName(sheetName);
  if (!targetSheet) return [];
  var values = targetSheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  var headers = values[0];
  var list = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var val = values[i][j];
      if (typeof val === 'string' && (val.indexOf('[') === 0 || val.indexOf('{') === 0)) {
        try { val = JSON.parse(val); } catch(e) {}
      }
      obj[headers[j]] = val;
    }
    list.push(obj);
  }
  return list;
}

function appendRowToSheet(sheet, sheetName, item) {
  var targetSheet = sheet.getSheetByName(sheetName);
  if (!targetSheet) return;
  var headers = targetSheet.getDataRange().getValues()[0];
  var newRow = [];
  for (var i = 0; i < headers.length; i++) {
    var val = item[headers[i]];
    if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
    newRow.push(val !== undefined ? val : "");
  }
  targetSheet.appendRow(newRow);
}

function upsertRowInSheet(sheet, sheetName, item, idKey) {
  var targetSheet = sheet.getSheetByName(sheetName);
  if (!targetSheet) return;
  var data = targetSheet.getDataRange().getValues();
  var headers = data[0];
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === item[idKey]) { rowIndex = i + 1; break; }
  }
  var rowValues = [];
  for (var j = 0; j < headers.length; j++) {
    var val = item[headers[j]];
    if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
    rowValues.push(val !== undefined ? val : "");
  }
  if (rowIndex !== -1) {
    targetSheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
  } else {
    targetSheet.appendRow(rowValues);
  }
  formatSheetVisuals(targetSheet);
}

function deleteRowFromSheet(sheet, sheetName, id, idKey) {
  var targetSheet = sheet.getSheetByName(sheetName);
  if (!targetSheet) return;
  var data = targetSheet.getDataRange().getValues();
  var headers = data[0];
  var idColIdx = headers.indexOf(idKey);
  for (var i = 1; i < data.length; i++) {
    if (data[i][idColIdx] === id) { targetSheet.deleteRow(i + 1); break; }
  }
}

function updateSheetHeaders(sheet, sheetName, expectedHeaders) {
  var targetSheet = sheet.getSheetByName(sheetName);
  if (!targetSheet) return;
  var lastCol = targetSheet.getLastColumn();
  if (lastCol === 0) { targetSheet.appendRow(expectedHeaders); return; }
  var values = targetSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var missing = expectedHeaders.filter(function(h) { return values.indexOf(h) === -1; });
  if (missing.length > 0) targetSheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
}

function adjustStock(sheet, items, type) {
  if (!items || items.length === 0) return;
  var productsSheet = sheet.getSheetByName("Products");
  if (!productsSheet) return;
  var productsData = productsSheet.getDataRange().getValues();
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    for (var j = 1; j < productsData.length; j++) {
      if (productsData[j][0] === item.productId) {
        var currStock = parseFloat(productsData[j][10] || 0);
        var delta = type === "sale" ? -item.quantity : item.quantity;
        productsSheet.getRange(j+1, 11).setValue(currStock + delta);
        break;
      }
    }
  }
}

function adjustBankForInvoice(sheet, txn, actionType) {
  var bankSheet = sheet.getSheetByName("BankAccounts");
  if (!bankSheet) return;
  var bankData = bankSheet.getDataRange().getValues();
  var cashIdx = -1, bankIdx = -1;
  for (var k = 1; k < bankData.length; k++) {
    if (bankData[k][0] === "BA001") cashIdx = k + 1;
    if (bankData[k][0] === "BA002") bankIdx = k + 1;
  }
  var totals = txn.totals || {};
  var paidCash = parseFloat(totals.paidCash || 0);
  var paidBank = parseFloat(totals.paidBank || 0);
  var multiplier = actionType === "saveInvoice" ? 1 : -1;
  if (paidCash > 0 && cashIdx !== -1) {
    var currBal = parseFloat(bankSheet.getRange(cashIdx, 8).getValue() || 0);
    bankSheet.getRange(cashIdx, 8).setValue(currBal + (paidCash * multiplier));
  }
  if (paidBank > 0 && bankIdx !== -1) {
    var currBal = parseFloat(bankSheet.getRange(bankIdx, 8).getValue() || 0);
    bankSheet.getRange(bankIdx, 8).setValue(currBal + (paidBank * multiplier));
  }
}

function adjustLinkedInvoiceSheet(sheet, linkedInvoiceNo, amount, mode, isRollback) {
  if (!linkedInvoiceNo) return;
  var txnsSheet = sheet.getSheetByName("Transactions");
  if (!txnsSheet) return;
  var data = txnsSheet.getDataRange().getValues();
  var headers = data[0];
  var voucherColIdx = headers.indexOf("voucherNo");
  var txnTypeColIdx = headers.indexOf("txnType");
  var totalsColIdx = headers.indexOf("totals");
  for (var i = 1; i < data.length; i++) {
    if (data[i][voucherColIdx] === linkedInvoiceNo && data[i][txnTypeColIdx] === "Sale") {
      var totals = {};
      try { totals = JSON.parse(data[i][totalsColIdx]); } catch(e) {}
      var paidCash = parseFloat(totals.paidCash || 0);
      var paidBank = parseFloat(totals.paidBank || 0);
      var grandTotal = parseFloat(totals.grandTotal || 0);
      var change = isRollback ? -amount : amount;
      if (mode === "Cash") paidCash = Math.max(0, paidCash + change);
      else paidBank = Math.max(0, paidBank + change);
      totals.paidCash = paidCash;
      totals.paidBank = paidBank;
      totals.balanceDue = Math.max(0, grandTotal - (paidCash + paidBank));
      txnsSheet.getRange(i+1, totalsColIdx+1).setValue(JSON.stringify(totals));
      break;
    }
  }
}

function logActivityInternal(sheet, userId, userName, action, module, details) {
  try {
    var logSheet = sheet.getSheetByName("ActivityLog");
    if (!logSheet) return;
    var id = "LOG" + Date.now();
    logSheet.appendRow([id, new Date().toISOString(), userId, userName, action, module, details || ""]);
  } catch(e) {}
}

// ===================== ROLLBACK =====================

function rollbackSheetBalances(sheet, txnId) {
  var txns = readSheetData(sheet, "Transactions");
  var oldTxn = null;
  for (var i = 0; i < txns.length; i++) {
    if (txns[i].id === txnId) { oldTxn = txns[i]; break; }
  }
  if (!oldTxn) return;

  if ((oldTxn.txnType === "Sale" || oldTxn.txnType === "Purchase") && oldTxn.items) {
    var productsSheet = sheet.getSheetByName("Products");
    var productsData = productsSheet.getDataRange().getValues();
    var items = oldTxn.items;
    for (var i = 0; i < items.length; i++) {
      for (var j = 1; j < productsData.length; j++) {
        if (productsData[j][0] === items[i].productId) {
          var currStock = parseFloat(productsData[j][10] || 0);
          var delta = oldTxn.txnType === "Sale" ? items[i].quantity : -items[i].quantity;
          productsSheet.getRange(j+1, 11).setValue(currStock + delta);
          break;
        }
      }
    }
  } else if (oldTxn.txnType === "Return" && oldTxn.items) {
    var productsSheet = sheet.getSheetByName("Products");
    var productsData = productsSheet.getDataRange().getValues();
    var items = oldTxn.items;
    for (var i = 0; i < items.length; i++) {
      for (var j = 1; j < productsData.length; j++) {
        if (productsData[j][0] === items[i].productId) {
          var currStock = parseFloat(productsData[j][10] || 0);
          var delta = oldTxn.returnType === "Sales" ? -items[i].quantity : items[i].quantity;
          productsSheet.getRange(j+1, 11).setValue(currStock + delta);
          break;
        }
      }
    }
  }

  var bankSheet = sheet.getSheetByName("BankAccounts");
  if (!bankSheet) return;
  var bankData = bankSheet.getDataRange().getValues();
  var cashIdx = -1, bankIdx = -1;
  for (var k = 1; k < bankData.length; k++) {
    if (bankData[k][0] === "BA001") cashIdx = k + 1;
    if (bankData[k][0] === "BA002") bankIdx = k + 1;
  }

  var updateBank = function(idx, delta) {
    if (idx === -1) return;
    var currBal = parseFloat(bankSheet.getRange(idx, 8).getValue() || 0);
    bankSheet.getRange(idx, 8).setValue(currBal + delta);
  };

  if (oldTxn.txnType === "Sale") {
    var totals = oldTxn.totals || {};
    updateBank(cashIdx, -parseFloat(totals.paidCash || 0));
    updateBank(bankIdx, -parseFloat(totals.paidBank || 0));
  } else if (oldTxn.txnType === "Purchase") {
    var totals = oldTxn.totals || {};
    updateBank(cashIdx, parseFloat(totals.paidCash || 0));
    updateBank(bankIdx, parseFloat(totals.paidBank || 0));
  } else if (oldTxn.txnType === "Receipt") {
    var credit = parseFloat(oldTxn.credit || 0);
    if (oldTxn.paymentMode === "Cash") updateBank(cashIdx, -credit);
    else updateBank(bankIdx, -credit);
    if (oldTxn.linkedInvoice) adjustLinkedInvoiceSheet(sheet, oldTxn.linkedInvoice, credit, oldTxn.paymentMode, true);
  } else if (oldTxn.txnType === "Payment") {
    var debit = parseFloat(oldTxn.debit || 0);
    if (oldTxn.paymentMode === "Cash") updateBank(cashIdx, debit);
    else updateBank(bankIdx, debit);
  } else if (oldTxn.txnType === "Banking") {
    var totals = oldTxn.totals || {};
    var type = totals.type;
    var amount = parseFloat(totals.grandTotal || 0);
    for (var k = 1; k < bankData.length; k++) {
      var accId = bankData[k][0];
      var rowIdx = k + 1;
      var currBal = parseFloat(bankSheet.getRange(rowIdx, 8).getValue() || 0);
      if (type === "Deposit") {
        if (accId === "BA001") bankSheet.getRange(rowIdx, 8).setValue(currBal + amount);
        if (accId === "BA002") bankSheet.getRange(rowIdx, 8).setValue(currBal - amount);
      } else if (type === "Withdrawal") {
        if (accId === "BA001") bankSheet.getRange(rowIdx, 8).setValue(currBal - amount);
        if (accId === "BA002") bankSheet.getRange(rowIdx, 8).setValue(currBal + amount);
      } else if (type === "Transfer") {
        if (accId === totals.fromAccountId) bankSheet.getRange(rowIdx, 8).setValue(currBal + amount);
        if (accId === totals.toAccountId) bankSheet.getRange(rowIdx, 8).setValue(currBal - amount);
      }
    }
  } else if (oldTxn.txnType === "SecurityDeposit") {
    var credit = parseFloat(oldTxn.credit || 0);
    if (oldTxn.paymentMode === "Cash") updateBank(cashIdx, -credit);
    else updateBank(bankIdx, -credit);
  } else if (oldTxn.txnType === "SecurityRefund") {
    var amount = parseFloat(oldTxn.totals && oldTxn.totals.grandTotal || 0);
    if (oldTxn.paymentMode === "Cash") updateBank(cashIdx, amount);
    else updateBank(bankIdx, amount);
  }
}

// ===================== REPORTS =====================

function getDashboardStats(sheet) {
  var txns = readSheetData(sheet, "Transactions");
  var products = readSheetData(sheet, "Products");
  var parties = readSheetData(sheet, "Parties");
  var bankAccounts = readSheetData(sheet, "BankAccounts");
  var expenses = readSheetData(sheet, "Expenses");

  var today = new Date();
  var thisMonth = today.getMonth();
  var thisYear = today.getFullYear();
  var todayStr = today.toISOString().split('T')[0];

  var stats = {
    success: true,
    totalSalesMonth: 0, totalSalesYear: 0, totalSalesToday: 0,
    totalPurchaseMonth: 0, totalPurchaseYear: 0,
    totalReceiptsMonth: 0,
    totalExpensesMonth: 0,
    cashBalance: 0, bankBalance: 0,
    totalReceivable: 0, totalPayable: 0,
    lowStockCount: 0,
    monthlyData: [],
    topParties: [],
    recentTxns: []
  };

  bankAccounts.forEach(function(b) {
    if (b.id === "BA001") stats.cashBalance = parseFloat(b.balance || 0);
    if (b.id === "BA002") stats.bankBalance = parseFloat(b.balance || 0);
  });

  var monthly = {};
  for (var m = 0; m < 12; m++) {
    monthly[m] = { sales: 0, purchase: 0, expense: 0 };
  }

  txns.forEach(function(t) {
    var d = new Date(t.date);
    var tYear = d.getFullYear();
    var tMonth = d.getMonth();
    var tDate = t.date;
    var totals = t.totals || {};
    var grandTotal = parseFloat(totals.grandTotal || 0);

    if (t.txnType === "Sale") {
      if (tYear === thisYear) {
        stats.totalSalesYear += grandTotal;
        if (tMonth === thisMonth) stats.totalSalesMonth += grandTotal;
        if (tDate === todayStr) stats.totalSalesToday += grandTotal;
        monthly[tMonth].sales += grandTotal;
      }
    } else if (t.txnType === "Purchase") {
      if (tYear === thisYear) {
        stats.totalPurchaseYear += grandTotal;
        if (tMonth === thisMonth) stats.totalPurchaseMonth += grandTotal;
        monthly[tMonth].purchase += grandTotal;
      }
    } else if (t.txnType === "Receipt") {
      if (tYear === thisYear && tMonth === thisMonth) stats.totalReceiptsMonth += parseFloat(t.credit || 0);
    }
  });

  expenses.forEach(function(e) {
    var d = new Date(e.date);
    if (d.getFullYear() === thisYear && d.getMonth() === thisMonth) {
      stats.totalExpensesMonth += parseFloat(e.amount || 0);
    }
    if (d.getFullYear() === thisYear) {
      monthly[d.getMonth()].expense += parseFloat(e.amount || 0);
    }
  });

  var partyBalance = {};
  parties.forEach(function(p) {
    partyBalance[p.id] = { name: p.name, type: p.type, balance: parseFloat(p.openingBalance || 0) };
  });
  txns.forEach(function(t) {
    if (!partyBalance[t.partyId]) return;
    partyBalance[t.partyId].balance += parseFloat(t.debit || 0) - parseFloat(t.credit || 0);
  });
  Object.keys(partyBalance).forEach(function(pid) {
    var bal = partyBalance[pid].balance;
    if (bal > 0) stats.totalReceivable += bal;
    else stats.totalPayable += Math.abs(bal);
  });

  var monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  for (var m = 0; m < 12; m++) {
    stats.monthlyData.push({ month: monthNames[m], sales: monthly[m].sales, purchase: monthly[m].purchase, expense: monthly[m].expense });
  }

  products.forEach(function(p) {
    if (parseFloat(p.stock || 0) <= parseFloat(p.minStock || 0)) stats.lowStockCount++;
  });

  stats.recentTxns = txns.sort(function(a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 10);

  return stats;
}

function generateReport(sheet, reportType, dateFrom, dateTo, partyId) {
  var txns = readSheetData(sheet, "Transactions");
  var expenses = readSheetData(sheet, "Expenses");
  var products = readSheetData(sheet, "Products");
  var parties = readSheetData(sheet, "Parties");

  var from = dateFrom ? new Date(dateFrom) : new Date("2000-01-01");
  var to = dateTo ? new Date(dateTo) : new Date();
  to.setHours(23, 59, 59);

  var filtered = txns.filter(function(t) {
    var d = new Date(t.date);
    return d >= from && d <= to;
  });

  if (reportType === "daybook") {
    return { success: true, type: "daybook", data: filtered.sort(function(a,b){ return new Date(a.date)-new Date(b.date); }) };
  }

  if (reportType === "pl") {
    var totalSales = 0, totalPurchase = 0, totalReceipts = 0, totalPayments = 0, totalExpenses = 0;
    filtered.forEach(function(t) {
      var g = parseFloat(t.totals && t.totals.grandTotal || 0);
      if (t.txnType === "Sale") totalSales += g;
      else if (t.txnType === "Purchase") totalPurchase += g;
      else if (t.txnType === "Receipt") totalReceipts += parseFloat(t.credit || 0);
      else if (t.txnType === "Payment") totalPayments += parseFloat(t.debit || 0);
    });
    var filteredExp = expenses.filter(function(e) {
      var d = new Date(e.date);
      return d >= from && d <= to;
    });
    filteredExp.forEach(function(e) { totalExpenses += parseFloat(e.amount || 0); });
    var grossProfit = totalSales - totalPurchase;
    var netProfit = grossProfit - totalExpenses;
    return { success: true, type: "pl", data: { totalSales: totalSales, totalPurchase: totalPurchase, grossProfit: grossProfit, totalExpenses: totalExpenses, netProfit: netProfit, totalReceipts: totalReceipts, totalPayments: totalPayments } };
  }

  if (reportType === "stock") {
    var stockData = products.map(function(p) {
      var value = parseFloat(p.stock || 0) * parseFloat(p.purchaseRate || 0);
      return { id: p.id, name: p.name, category: p.category, unit: p.unit, stock: parseFloat(p.stock || 0), minStock: parseFloat(p.minStock || 0), purchaseRate: parseFloat(p.purchaseRate || 0), saleRate: parseFloat(p.saleRate || 0), value: value, isLow: parseFloat(p.stock || 0) <= parseFloat(p.minStock || 0) };
    });
    return { success: true, type: "stock", data: stockData };
  }

  if (reportType === "partyLedger") {
    var party = null;
    for (var i = 0; i < parties.length; i++) {
      if (parties[i].id === partyId) { party = parties[i]; break; }
    }
    if (!party) return { success: false, message: "Party not found" };
    var ledger = filtered.filter(function(t) { return t.partyId === partyId; });
    var openingBal = parseFloat(party.openingBalance || 0);
    var runningBal = openingBal;
    var rows = ledger.sort(function(a,b){ return new Date(a.date)-new Date(b.date); }).map(function(t) {
      runningBal += parseFloat(t.debit || 0) - parseFloat(t.credit || 0);
      return { date: t.date, voucherNo: t.voucherNo, description: t.description, txnType: t.txnType, debit: parseFloat(t.debit || 0), credit: parseFloat(t.credit || 0), balance: runningBal };
    });
    return { success: true, type: "partyLedger", party: party, openingBalance: openingBal, data: rows, closingBalance: runningBal };
  }

  if (reportType === "outstanding") {
    var partyBalance = {};
    parties.forEach(function(p) {
      partyBalance[p.id] = { id: p.id, name: p.name, type: p.type, mobile: p.mobile, balance: parseFloat(p.openingBalance || 0) };
    });
    txns.forEach(function(t) {
      if (partyBalance[t.partyId]) {
        partyBalance[t.partyId].balance += parseFloat(t.debit || 0) - parseFloat(t.credit || 0);
      }
    });
    var data = Object.values(partyBalance).filter(function(p) { return Math.abs(p.balance) > 0; });
    return { success: true, type: "outstanding", data: data };
  }

  if (reportType === "sales") {
    var data = filtered.filter(function(t) { return t.txnType === "Sale"; });
    return { success: true, type: "sales", data: data };
  }

  if (reportType === "purchase") {
    var data = filtered.filter(function(t) { return t.txnType === "Purchase"; });
    return { success: true, type: "purchase", data: data };
  }

  if (reportType === "expense") {
    var data = expenses.filter(function(e) {
      var d = new Date(e.date);
      return d >= from && d <= to;
    });
    var catTotals = {};
    data.forEach(function(e) {
      catTotals[e.category] = (catTotals[e.category] || 0) + parseFloat(e.amount || 0);
    });
    return { success: true, type: "expense", data: data, categoryTotals: catTotals };
  }

  return { success: false, message: "Unknown report type" };
}

// ===================== DATABASE INIT =====================

function initDatabase(sheet) {
  if (!sheet) { sheet = getSpreadsheet(); }
  if (!sheet) return;

  var allSheets = [
    "Parties", "Products", "Transactions", "BankAccounts", "Users",
    "Notifications", "CompanyProfile", "CylinderSecurity",
    "Expenses", "Quotations", "PurchaseOrders", "DeliveryChallans", "ActivityLog"
  ];

  var headerMap = {
    "Parties": ["id","name","type","mobile","email","address","gstin","pan","openingBalance","creditLimit","paymentTerms","bankAccount","bankName","ifsc","documents","securityDeposit","cylinderDeposits"],
    "Products": ["id","name","category","unit","hsn","purchaseRate","saleRate","gst","minStock","openingStock","stock","isCylinder"],
    "Transactions": ["id","date","voucherNo","partyId","partyName","description","txnType","debit","credit","paymentMode","bankRef","items","totals","enteredBy","enteredOn","cylinderOut","cylinderIn","linkedInvoice","returnType"],
    "BankAccounts": ["id","accountName","bankName","accountNo","ifsc","branch","openingBalance","balance"],
    "Users": ["id","name","email","passwordHash","role","partyId","status","permissions"],
    "Notifications": ["id","message","type","date","read"],
    "CompanyProfile": ["key","value"],
    "CylinderSecurity": ["id","partyId","partyName","cylinderType","totalOut","totalIn","pending","depositAmount","depositDate","refundAmount","refundDate","notes"],
    "Expenses": ["id","date","category","description","amount","paymentMode","bankRef","voucherId","enteredBy","enteredOn"],
    "Quotations": ["id","date","voucherNo","partyId","partyName","items","totals","validTill","status","notes","enteredBy","enteredOn"],
    "PurchaseOrders": ["id","date","voucherNo","partyId","partyName","items","totals","expectedDelivery","status","notes","enteredBy","enteredOn"],
    "DeliveryChallans": ["id","date","voucherNo","partyId","partyName","items","status","linkedInvoice","notes","enteredBy","enteredOn"],
    "ActivityLog": ["id","timestamp","userId","userName","action","module","details"]
  };

  allSheets.forEach(function(name) {
    if (!sheet.getSheetByName(name)) {
      var s = sheet.insertSheet(name);
      s.appendRow(headerMap[name]);
      if (name === "CompanyProfile") {
        s.appendRow(["companyName", "Mr.Rahul ERP"]);
        s.appendRow(["companyAddress", "123, Industrial Area, Mumbai - 400001"]);
        s.appendRow(["companyGstin", "27AAAAA0000A1Z5"]);
        s.appendRow(["companyPhone", "9800000001"]);
        s.appendRow(["companyEmail", "accounts@mrrahul.com"]);
        s.appendRow(["companyLogo", ""]);
        s.appendRow(["termsAndConditions", "1. All disputes subject to Mumbai jurisdiction.\n2. Goods once sold will not be taken back."]);
        s.appendRow(["financialYearStart", "04"]);
        s.appendRow(["gstEnabled", "true"]);
        s.appendRow(["invoicePrefix", "INV"]);
        s.appendRow(["purchasePrefix", "PUR"]);
        s.appendRow(["receiptPrefix", "REC"]);
        s.appendRow(["expensePrefix", "EXP"]);
      }
    } else {
      if (headerMap[name]) updateSheetHeaders(sheet, name, headerMap[name]);
    }
  });

  sheet.getSheets().forEach(function(s) { formatSheetVisuals(s); });
}

function clearSheetDatabase(sheet) {
  if (!sheet) sheet = getSpreadsheet();
  if (!sheet) return;

  var headerMap = {
    "Parties": ["id","name","type","mobile","email","address","gstin","pan","openingBalance","creditLimit","paymentTerms","bankAccount","bankName","ifsc","documents","securityDeposit","cylinderDeposits"],
    "Products": ["id","name","category","unit","hsn","purchaseRate","saleRate","gst","minStock","openingStock","stock","isCylinder"],
    "Transactions": ["id","date","voucherNo","partyId","partyName","description","txnType","debit","credit","paymentMode","bankRef","items","totals","enteredBy","enteredOn","cylinderOut","cylinderIn","linkedInvoice","returnType"],
    "BankAccounts": ["id","accountName","bankName","accountNo","ifsc","branch","openingBalance","balance"],
    "Users": ["id","name","email","passwordHash","role","partyId","status","permissions"],
    "Notifications": ["id","message","type","date","read"],
    "CompanyProfile": ["key","value"],
    "Expenses": ["id","date","category","description","amount","paymentMode","bankRef","voucherId","enteredBy","enteredOn"],
    "Quotations": ["id","date","voucherNo","partyId","partyName","items","totals","validTill","status","notes","enteredBy","enteredOn"],
    "PurchaseOrders": ["id","date","voucherNo","partyId","partyName","items","totals","expectedDelivery","status","notes","enteredBy","enteredOn"],
    "DeliveryChallans": ["id","date","voucherNo","partyId","partyName","items","status","linkedInvoice","notes","enteredBy","enteredOn"]
  };

  Object.keys(headerMap).forEach(function(name) {
    var s = sheet.getSheetByName(name);
    if (s) {
      var lastRow = s.getLastRow();
      if (lastRow > 1) s.deleteRows(2, lastRow - 1);
    } else {
      s = sheet.insertSheet(name);
      s.appendRow(headerMap[name]);
    }
  });

  appendRowToSheet(sheet, "Users", { id: "U001", name: "Admin", email: "admin@mrrahul.com", passwordHash: simpleHash("admin123"), role: "Admin", partyId: "", status: "Active", permissions: JSON.stringify({ dashboard:true,sales:true,purchase:true,ledger:true,reports:true,products:true,parties:true,banking:true,users:true,returns:true,expenses:true,quotations:true }) });
  appendRowToSheet(sheet, "BankAccounts", { id: "BA001", accountName: "Main Cash", bankName: "Cash In Hand", accountNo: "--", ifsc: "--", branch: "Office", openingBalance: 0, balance: 0 });
  appendRowToSheet(sheet, "BankAccounts", { id: "BA002", accountName: "SBI Bank Account", bankName: "State Bank of India", accountNo: "9988776655", ifsc: "SBIN0001234", branch: "Main Branch", openingBalance: 0, balance: 0 });

  var defaultProfile = [
    ["companyName","Mr.Rahul ERP"],["companyAddress","123, Industrial Area, Mumbai - 400001"],
    ["companyGstin","27AAAAA0000A1Z5"],["companyPhone","9800000001"],
    ["companyEmail","accounts@mrrahul.com"],["companyLogo",""],
    ["termsAndConditions","1. All disputes subject to Mumbai jurisdiction.\n2. Goods once sold will not be taken back."],
    ["financialYearStart","04"],["gstEnabled","true"],
    ["invoicePrefix","INV"],["purchasePrefix","PUR"],["receiptPrefix","REC"],["expensePrefix","EXP"]
  ];
  defaultProfile.forEach(function(row) {
    appendRowToSheet(sheet, "CompanyProfile", { key: row[0], value: row[1] });
  });

  sheet.getSheets().forEach(function(s) { formatSheetVisuals(s); });
}

function seedSheetDatabase(sheet) {
  if (!sheet) sheet = getSpreadsheet();
  if (!sheet) return;
  clearSheetDatabase(sheet);

  var parties = [
    { id:"PT001", name:"Ravi Traders", type:"Customer", mobile:"9876543210", email:"ravi@ravi.com", address:"Mumbai, MH", gstin:"27AAAAA0000A1Z5", pan:"AAAAA1234A", openingBalance:10000, creditLimit:100000, paymentTerms:30, bankAccount:"1234567890", bankName:"SBI", ifsc:"SBIN0001234", documents:[] },
    { id:"PT002", name:"Patel Supplies", type:"Supplier", mobile:"9812345678", email:"patel@patel.com", address:"Ahmedabad, GJ", gstin:"24BBBBB1111B2Z6", pan:"BBBBB5678B", openingBalance:-5000, creditLimit:200000, paymentTerms:15, bankAccount:"9876543210", bankName:"HDFC", ifsc:"HDFC0000456", documents:[] },
    { id:"PT003", name:"Kumar Builders", type:"Customer", mobile:"9988776655", email:"kumar@kumar.com", address:"Pune, MH", gstin:"27CCCCC2222C3Z7", pan:"CCCCC9999C", openingBalance:0, creditLimit:50000, paymentTerms:45, bankAccount:"1122334455", bankName:"ICICI", ifsc:"ICIC0000789", documents:[] }
  ];
  parties.forEach(function(p) { appendRowToSheet(sheet, "Parties", p); });

  var products = [
    { id:"P001", name:"Cement 50kg", category:"Building Materials", unit:"Bag", hsn:"2523", purchaseRate:300, saleRate:380, gst:28, minStock:50, openingStock:500, stock:460, isCylinder:false },
    { id:"P002", name:"Steel Rod 12mm", category:"Iron & Steel", unit:"Kg", hsn:"7214", purchaseRate:50, saleRate:65, gst:18, minStock:100, openingStock:850, stock:850, isCylinder:false },
    { id:"P003", name:"Bricks Red", category:"Building Materials", unit:"Pcs", hsn:"6901", purchaseRate:6, saleRate:8, gst:5, minStock:1000, openingStock:15000, stock:15000, isCylinder:false },
    { id:"P004", name:"Paint White 20L", category:"Finishing", unit:"Box", hsn:"3208", purchaseRate:2200, saleRate:2800, gst:18, minStock:10, openingStock:5, stock:5, isCylinder:false },
    { id:"P005", name:"LPG Cylinder 14.2kg", category:"LPG Cylinder", unit:"Pcs", hsn:"7311", purchaseRate:800, saleRate:1050, gst:18, minStock:10, openingStock:100, stock:100, isCylinder:true }
  ];
  products.forEach(function(p) { appendRowToSheet(sheet, "Products", p); });

  var banks = [
    { id:"BA001", accountName:"Main Cash", bankName:"Cash In Hand", accountNo:"--", ifsc:"--", branch:"Office", openingBalance:50000, balance:45000 },
    { id:"BA002", accountName:"SBI Bank Account", bankName:"State Bank of India", accountNo:"9988776655", ifsc:"SBIN0001234", branch:"Main Branch", openingBalance:150000, balance:165000 }
  ];
  banks.forEach(function(b) { upsertRowInSheet(sheet, "BankAccounts", b, "id"); });

  var users = [
    { id:"U001", name:"Admin", email:"admin@mrrahul.com", passwordHash:simpleHash("admin123"), role:"Admin", partyId:"", status:"Active", permissions:JSON.stringify({dashboard:true,sales:true,purchase:true,ledger:true,reports:true,products:true,parties:true,banking:true,users:true,returns:true,expenses:true,quotations:true}) },
    { id:"U002", name:"Manager", email:"manager@mrrahul.com", passwordHash:simpleHash("manager123"), role:"Manager", partyId:"", status:"Active", permissions:JSON.stringify({dashboard:true,sales:true,purchase:true,ledger:true,reports:true,products:true,parties:true,banking:false,users:false,returns:true,expenses:true,quotations:true}) },
    { id:"U003", name:"Ravi (Party)", email:"ravi@mrrahul.com", passwordHash:simpleHash("ravi123"), role:"Party", partyId:"PT001", status:"Active", permissions:JSON.stringify({dashboard:true,sales:false,purchase:false,ledger:true,reports:false,products:false,parties:false,banking:false,users:false,returns:false,expenses:false,quotations:false}) }
  ];
  users.forEach(function(u) { upsertRowInSheet(sheet, "Users", u, "id"); });

  var expenses = [
    { id:"EXP001", date:"2026-04-01", category:"Rent", description:"Office Rent April", amount:15000, paymentMode:"Bank", bankRef:"NEFT001", voucherId:"", enteredBy:"U001", enteredOn:"2026-04-01T10:00:00Z" },
    { id:"EXP002", date:"2026-04-05", category:"Electricity", description:"Electricity Bill", amount:3500, paymentMode:"Cash", bankRef:"", voucherId:"", enteredBy:"U001", enteredOn:"2026-04-05T11:00:00Z" },
    { id:"EXP003", date:"2026-04-10", category:"Transport", description:"Delivery charges", amount:2000, paymentMode:"Cash", bankRef:"", voucherId:"", enteredBy:"U001", enteredOn:"2026-04-10T09:00:00Z" }
  ];
  expenses.forEach(function(e) { appendRowToSheet(sheet, "Expenses", e); });

  var notifications = [
    { id:"N001", message:"Low stock alert: Paint White 20L is below minimum!", type:"warning", date:"2026-04-22T06:00:00Z", read:false },
    { id:"N002", message:"Welcome to Mr.Rahul ERP System!", type:"info", date:"2026-04-01T10:00:00Z", read:true }
  ];
  notifications.forEach(function(n) { appendRowToSheet(sheet, "Notifications", n); });

  sheet.getSheets().forEach(function(s) { formatSheetVisuals(s); });
}

// ===================== VISUAL FORMATTING =====================

function formatSheetVisuals(sheetObject) {
  if (!sheetObject) return;
  sheetObject.setHiddenGridlines(false);
  var lastRow = sheetObject.getLastRow();
  var lastCol = sheetObject.getLastColumn();
  if (lastRow === 0 || lastCol === 0) return;

  sheetObject.setRowHeight(1, 28);
  if (lastRow > 1) sheetObject.setRowHeights(2, lastRow - 1, 22);

  var headerRange = sheetObject.getRange(1, 1, 1, lastCol);
  headerRange.setBackground("#0B111E").setFontColor("#E5C158").setFontWeight("bold").setFontFamily("Roboto").setHorizontalAlignment("center").setVerticalAlignment("middle");

  var headers = headerRange.getValues()[0];
  var currencyHeaders = ["openingBalance","creditLimit","purchaseRate","saleRate","debit","credit","balance","depositAmount","refundAmount","securityDeposit","amount","grandTotal","subTotal"];
  var integerHeaders = ["minStock","openingStock","stock","cylinderOut","cylinderIn","totalOut","totalIn","pending","paymentTerms"];
  var centerHeaders = ["id","date","voucherNo","partyId","txnType","paymentMode","enteredBy","enteredOn","role","status","type","read","cylinderType","depositDate","refundDate","unit","hsn","isCylinder","key","validTill","expectedDelivery"];

  for (var col = 1; col <= lastCol; col++) {
    if (lastRow > 1) {
      var colRange = sheetObject.getRange(2, col, lastRow - 1, 1);
      colRange.setFontFamily("Roboto").setFontSize(10).setVerticalAlignment("middle");
      var h = headers[col - 1];
      if (currencyHeaders.indexOf(h) !== -1) { colRange.setHorizontalAlignment("right").setNumberFormat("₹#,##0.00"); }
      else if (integerHeaders.indexOf(h) !== -1) { colRange.setHorizontalAlignment("right").setNumberFormat("#,##0"); }
      else if (centerHeaders.indexOf(h) !== -1) { colRange.setHorizontalAlignment("center"); }
      else { colRange.setHorizontalAlignment("left"); }
    }
  }

  if (lastRow > 1) {
    var dataRange = sheetObject.getRange(2, 1, lastRow - 1, lastCol);
    dataRange.setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);
    var backgrounds = [];
    for (var r = 2; r <= lastRow; r++) {
      var rowBg = [];
      var color = (r % 2 === 0) ? "#FFFFFF" : "#F8FAFC";
      for (var c = 0; c < lastCol; c++) rowBg.push(color);
      backgrounds.push(rowBg);
    }
    dataRange.setBackgrounds(backgrounds);
  }

  sheetObject.autoResizeColumns(1, lastCol);
  for (var col = 1; col <= lastCol; col++) {
    if (sheetObject.getColumnWidth(col) < 100) sheetObject.setColumnWidth(col, 100);
  }
}

function simpleHash(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function getPremiumEmailTemplate(userName, tempPassword, companyName, companyLogo, appUrl) {
  var logoHtml = "";
  if (companyLogo) {
    logoHtml = '<img src="' + companyLogo + '" alt="' + companyName + ' Logo" style="max-height: 50px; max-width: 150px; margin-bottom: 20px; object-fit: contain;">';
  } else {
    logoHtml = '<h2 style="color: #10B981; margin: 0; font-size: 24px; font-weight: 800; font-family: \'Inter\', sans-serif;">' + companyName + '</h2>';
  }

  var loginLink = appUrl || "https://netlify.app";

  var html = 
    '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
    '  <meta charset="utf-8">' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '  <title>Password Reset Approved</title>' +
    '  <style>' +
    '    body { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0F172A; color: #E2E8F0; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }' +
    '    .wrapper { width: 100%; background-color: #020617; padding: 40px 0; }' +
    '    .container { max-width: 580px; margin: 0 auto; background: #0F172A; border: 1px solid #1E293B; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3); }' +
    '    .header { padding: 32px; text-align: center; border-bottom: 1px solid #1E293B; background: #1E293B; }' +
    '    .body { padding: 32px 40px; }' +
    '    .title { color: #FFFFFF; font-size: 20px; font-weight: 700; margin-bottom: 16px; }' +
    '    .text { color: #94A3B8; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }' +
    '    .credentials-box { background: #020617; border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px; padding: 24px; margin-bottom: 28px; text-align: center; }' +
    '    .label { color: #64748B; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }' +
    '    .password { color: #10B981; font-family: monospace; font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 0; }' +
    '    .btn-container { text-align: center; margin-top: 10px; }' +
    '    .btn { display: inline-block; padding: 12px 28px; background: #10B981; color: #FFFFFF !important; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.25); }' +
    '    .footer { padding: 24px; text-align: center; font-size: 12px; color: #475569; border-top: 1px solid #1E293B; background: #020617; }' +
    '    .footer-text { margin: 4px 0; }' +
    '  </style>' +
    '</head>' +
    '<body>' +
    '  <div class="wrapper">' +
    '    <div class="container">' +
    '      <div class="header">' +
    '        ' + logoHtml +
    '      </div>' +
    '      <div class="body">' +
    '        <h2 class="title">Hello ' + userName + ',</h2>' +
    '        <p class="text">Your request to reset your password has been approved by the Administrator. We have generated a secure temporary password for your account. Please use the credentials below to log in:</p>' +
    '        <div class="credentials-box">' +
    '          <div class="label">Temporary Password</div>' +
    '          <div class="password">' + tempPassword + '</div>' +
    '        </div>' +
    '        <p class="text">For security reasons, we strongly recommend that you change this temporary password immediately after logging in by going to your ERP account settings page.</p>' +
    '        <div class="btn-container">' +
    '          <a href="' + loginLink + '" class="btn" target="_blank">Login to ERP Dashboard</a>' +
    '        </div>' +
    '      </div>' +
    '      <div class="footer">' +
    '        <p class="footer-text">This is an automated system email from ' + companyName + '.</p>' +
    '        <p class="footer-text">Please do not reply directly to this message.</p>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</body>' +
    '</html>';

  return html;
}
