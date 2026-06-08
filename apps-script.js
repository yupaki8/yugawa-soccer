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
      } else {
        // 不足している列をシートに追加（スキーマ追加への自動対応）
        var missingCols = headers.filter(function(h) { return firstRow.indexOf(h) === -1; });
        if (missingCols.length > 0) {
          ws.getRange(1, firstRow.length + 1, 1, missingCols.length).setValues([missingCols]);
        }
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

  if (action === 'analyzeImage') {
    var apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
    if (!apiKey) return json({ ok: false, error: 'CLAUDE_API_KEY が未設定です（スクリプトプロパティを確認）' });

    var systemPrompt = 'あなたは試合案内から情報を抽出するAIです。\n画像・PDFを読み取り、以下のキーを使ったJSONの配列を出力してください（説明文・コードブロック等は不要）。\n1件でも必ず [{...}] の配列形式にすること。複数の日程が含まれる場合は複数オブジェクトの配列にすること。\n\n各オブジェクトのキー:\n- team: "fa"（湯川FA、U10〜U12）or "chu"（湯川中学校、U15）\n- type: "of"（公式戦）/ "tr"（練習試合・TRM）/ "ot"（その他）\n- cat: "U10" / "U11" / "U12" / "U15" / "その他"\n- date: "YYYY-MM-DD"\n- ttl: タイトル・大会名\n- ga: "HH:MM"（クラブハウス集合時刻）\n- gv: "HH:MM"（会場集合時刻）\n- dismiss: "HH:MM"（解散予定）\n- ve: 会場名\n- gl: 集合場所\n- matches: 試合リスト（配列）。例: [{"opp":"vs 中間FC","ko":"10:00"}]。KO時刻不明なら ko を省略。\n- fee: 参加費・交通費\n- mo: 持ち物・メモ\n\n読み取れない項目はキーごと省略。teamが不明なら"fa"。JSON配列のみ出力。';

    var contentItems = [];
    if (payload.images && payload.images.length) {
      payload.images.forEach(function(img) {
        var ct = img.mimeType === 'application/pdf' ? 'document' : 'image';
        contentItems.push({ type: ct, source: { type: 'base64', media_type: img.mimeType || 'image/jpeg', data: img.base64 } });
      });
    } else {
      var mediaType = payload.mimeType || 'image/jpeg';
      var ct = mediaType === 'application/pdf' ? 'document' : 'image';
      contentItems.push({ type: ct, source: { type: 'base64', media_type: mediaType, data: payload.base64 } });
    }
    contentItems.push({ type: 'text', text: '上記の画像・PDFすべてから試合情報を読み取り、JSON配列で出力してください。' });

    var messages = [{ role: 'user', content: contentItems }];
    var reqBody = { model: 'claude-haiku-4-5-20251001', max_tokens: 2048, system: systemPrompt, messages: messages };
    var opts = {
      method: 'post',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      payload: JSON.stringify(reqBody),
      muteHttpExceptions: true
    };

    var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', opts);
    var parsed = JSON.parse(resp.getContentText());
    if (parsed.content && parsed.content[0] && parsed.content[0].type === 'text') {
      return json({ ok: true, text: parsed.content[0].text });
    }
    var errMsg = parsed.error ? parsed.error.message : '不明なエラー';
    return json({ ok: false, error: errMsg });
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

function testGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName('events');
  if (!ws) { Logger.log('eventsシートが見つかりません'); return; }
  var rows = ws.getDataRange().getValues();
  Logger.log('行数（ヘッダー含む）: ' + rows.length);
  if (rows.length > 1) {
    Logger.log('ヘッダー: ' + JSON.stringify(rows[0]));
    Logger.log('1行目データ: ' + JSON.stringify(rows[1]));
  }
  var fakeE = { parameter: { sheet: 'events' } };
  var result = JSON.parse(doGet(fakeE).getContent());
  Logger.log('doGet返却件数: ' + result.length);
  if (result.length > 0) Logger.log('最初のイベント: ' + JSON.stringify(result[0]));
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
