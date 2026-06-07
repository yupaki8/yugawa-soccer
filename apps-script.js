function doGet(e) {
  var sheet = e.parameter.sheet || 'events';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(sheet);
  if (!ws) return json([]);
  var rows = ws.getDataRange().getValues();
  if (rows.length < 2) return json([]);
  var keys = rows[0];
  var data = rows.slice(1).map(function(row) {
    var obj = {};
    keys.forEach(function(k, i) {
      var v = row[i];
      if (k === 'date') {
        obj[k] = v instanceof Date ? Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd') : String(v || '');
      } else if (k === 'ga' || k === 'gv' || k === 'dismiss') {
        obj[k] = v instanceof Date ? Utilities.formatDate(v, 'Asia/Tokyo', 'HH:mm') : String(v || '');
      } else {
        obj[k] = (v === null || v === undefined) ? '' : String(v);
      }
    });
    return obj;
  });
  return json(data);
}

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var action = payload.action;
  var sheetName = payload.sheet;
  var data = payload.data;
  var id = payload.id;
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === 'save') {
    var ws = ss.getSheetByName(sheetName);
    var headers = sheetName === 'events'
      ? ['id','team','type','ttl','date','cat','ga','gv','dismiss','ve','vemap','gl','opponents','fee','imgurl','results','mo']
      : ['id','team','ttl','body','date'];

    if (!ws) {
      ws = ss.insertSheet(sheetName);
      ws.appendRow(headers);
    } else {
      var firstRow = ws.getDataRange().getValues()[0];
      if (!firstRow || firstRow[0] !== headers[0]) {
        ws.clearContents();
        ws.appendRow(headers);
      }
    }

    var allRows = ws.getDataRange().getValues();
    var headerRow = allRows[0];
    var existIdx = -1;
    for (var i = 1; i < allRows.length; i++) {
      if (allRows[i][0] === data.id) { existIdx = i; break; }
    }

    var rowData = headerRow.map(function(k) {
      var val = data[k];
      return String(val !== undefined && val !== null ? val : '');
    });

    if (existIdx > 0) {
      ws.getRange(existIdx + 1, 1, 1, rowData.length).setValues([rowData]);
    } else {
      ws.appendRow(rowData);
    }
    return json({ ok: true });
  }

  if (action === 'uploadImage') {
    var filename = payload.filename || 'image.jpg';
    var base64Data = payload.base64;
    var mimeType = payload.mimeType || 'image/jpeg';
    var bytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(bytes, mimeType, filename);
    var folderName = 'yugawa-soccer-images';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return json({ ok: true, url: 'https://drive.google.com/uc?export=view&id=' + file.getId() });
  }

  if (action === 'delete') {
    var ws2 = ss.getSheetByName(sheetName);
    if (!ws2) return json({ ok: false });
    var rows2 = ws2.getDataRange().getValues();
    for (var j = rows2.length - 1; j >= 1; j--) {
      if (rows2[j][0] === id) {
        ws2.deleteRow(j + 1);
        return json({ ok: true });
      }
    }
    return json({ ok: false });
  }

  return json({ ok: false });
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
