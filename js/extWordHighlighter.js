//XML2JSON
var x2js = new X2JS();

//Border colors

var borderColors = [];
var defaultBordercolor = "rgb(1, 1, 1)";
getBorderColors();

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  log("message received", request, sender);

  if (request.command == "getWords") {
    getKeywords(function (result) {
      let words = getWords(result)      
      sendResponse(words);
    });
    return true;
  }
  if (request.command == "getBorderColors") {
    sendResponse(borderColors);
  }
  if (request.command == "getEnvironment") {
    sendResponse({
      panelUrl: "chrome-extension://" + chrome.runtime.id + "/panel.html",
    });
  }
  if (request.command == "submitKeyword") {
    submitKeyword(request.requestObject, function (result) {
      sendResponse(result);
    });
  }

  if (request.command == "submitAllKeywords") {
    submitAllKeywords(request.allKeywords, function (result) {
      sendResponse(result);
    });
  }
});

chrome.runtime.onInstalled.addListener(function () {
  log("Regen Poc plugin installed");
  chrome.alarms.create("Data sync", { periodInMinutes: 10 });
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name == "Data sync") {
    getBorderColors();
  }
});

function getWords(words) {
  //groupsForUrl=getGroups(HighlightsData, inUrl,[]);
  //groupsForUrl=getGroups(SyncData, inUrl, groupsForUrl);
  //groupsForUrl = groupsForUrl.concat(syncGroupsForUrl);

  var wordsForUrl = { words: {}, regex: {} };

  //build the css classes
  //wordsForUrl.styles=buildStyles(groupsForUrl);

  //now let's calculate the regex and worlist
  wordsForUrl.words = transformWordsToWordList(words);
  wordsForUrl.regex = transformWordsToRegex(wordsForUrl.words);
  wordsForUrl.skipSelectors = skipSelectorsForUrl("");

  return wordsForUrl;
}

const buildStyles = (groupsForUrl) => {
  var styles = " ";

  //loop in reverse through the list. later styles win
  for (group in groupsForUrl) {
    element = groupsForUrl[group];
    // node type 3 text elements
    styles += " ." + getClassName(group, element.storage) + "{";
    if (HighlightsData.PrintHighlights) {
      styles += "padding: 1px;-webkit-print-color-adjust:exact;";
    } else {
      styles += "padding: 1px;";
    }

    if (element.style.tb) {
      styles += "background-color:" + element.style.tb + ";";
    }
    if (element.style.tf) {
      styles += "color:" + element.style.tf + ";";
    }

    if (element.style.tt) {
      styles += "font-weight: bold;";
    }
    if (element.style.ti) {
      styles += "font-style: italic !important;";
    }
    if (element.style.tu) {
      styles += "text-decoration: underline;";
    }
    if (element.style.ts) {
      styles += "box-shadow: 1px 1px #e5e5e5;";
    }
    if (element.style.tr) {
      styles += "border-radius: 3px";
    }

    styles += "}";

    // node type 1 input elements - outline style
    styles += " ." + getClassName(group, element.storage) + "-1 {";
    styles += "outline: 3px solid " + element.style.fo;
    styles += "}";
  }
  log("buildStyle", styles);
  return styles;
};

function getClassName(groupName, storage) {
  c = classes.find((c) => c.groupName === groupName && c.storage === storage);
  if (c) {
    return c.className;
  }
  //no class found for group, create one
  var className = "HLT" + uuidv4();
  classes.push({
    groupName: groupName,
    storage: storage,
    className: className,
  });
  return className;
}

function transformWordsToWordList(words) {
  var wordsArray = [];
  var regexFindBackAgainstContent = /\(\?\=|\(\?\!|\(\?\<\=|\(\?\<\!/gi;

  for (word in words) {
    var findBackAgainstContent = false;
    if (words[word].KeyWordVal.trim() !== "") {
      var regex = globStringToRegex(words[word].KeyWordVal);

      var action = { type: 99 };

      wordsArray.push({
        word: words[word].KeyWordVal.toLowerCase(),
        regex: regex,
        bColor: words[word].KeyWordBackClrHex,
        tColor: words[word].KeyWordTextClrHex,
        borderColor: defaultBordercolor,
        ProgID: words[word].ProgID,
        DomName: words[word].DomName,
        CatName: words[word].CatName,
        id: uuidv4(),
        FindWords: true,
        Matchtoken: "i",
        caseSensitive: false,
        findBackAgainstContent: findBackAgainstContent,
        action: action,
        // "KeyWordSrvID": words[word].KeyWordSrvID
      });
    }
  }

  return wordsArray;
}
function transformWordsToRegex(input) {
  var words = "";
  var wordparts = "";
  var wordsEditable = "";
  var wordpartsEditable = "";

  var wordsCS = "";
  var wordpartsCS = "";
  var wordsEditableCS = "";
  var wordpartsEditableCS = "";

  //reverse sort the keys based on length
  var sortedKeys = input.sort(function (a, b) {
    return b.word.length - a.word.length;
  });

  input.map(function (x) {
    return x.word;
  });

  for (word in sortedKeys) {
    if (sortedKeys[word].FindWords) {
      if (sortedKeys[word].caseSensitive) {
        wordsCS += sortedKeys[word].regex + "|";
        if (sortedKeys[word].ShowInEditableFields) {
          wordsEditableCS += sortedKeys[word].regex + "|";
        }
      } else {
        words += sortedKeys[word].regex + "|";
        if (sortedKeys[word].ShowInEditableFields) {
          wordsEditable += sortedKeys[word].regex + "|";
        }
      }
    } else {
      if (sortedKeys[word].caseSensitive) {
        wordpartsCS += sortedKeys[word].regex + "|";
        if (sortedKeys[word].ShowInEditableFields) {
          wordpartsEditableCS += sortedKeys[word].regex + "|";
        }
      } else {
        wordparts += sortedKeys[word].regex + "|";
        if (sortedKeys[word].ShowInEditableFields) {
          wordpartsEditable += sortedKeys[word].regex + "|";
        }
      }
    }
  }
  //regex for all words non case sensitive
  var re = "";
  if (words.length > 1) {
    words = words.substring(0, words.length - 1);
    re += "(" + words + ")";
    re = "\\b" + re + "\\b" + "|\\s" + re + "\\s";
  }
  if (wordparts.length > 1 && words.length > 1) {
    re += "|";
  }
  if (wordparts.length > 1) {
    wordparts = wordparts.substring(0, wordparts.length - 1);
    re += "(" + wordparts + ")";
  }
  matchRegex = re;

  //regex for all words  case sensitive
  var re = "";
  if (wordsCS.length > 1) {
    wordsCS = wordsCS.substring(0, wordsCS.length - 1);
    re += "(" + wordsCS + ")";
    re = "\\b" + re + "\\b" + "|\\s" + re + "\\s";
  }
  if (wordpartsCS.length > 1 && wordsCS.length > 1) {
    re += "|";
  }
  if (wordpartsCS.length > 1) {
    wordpartsCS = wordpartsCS.substring(0, wordpartsCS.length - 1);
    re += "(" + wordpartsCS + ")";
  }
  matchRegexCS = re;

  //ContentEditable regex non case sensitive
  var re = "";
  if (wordsEditable.length > 1) {
    wordsEditable = wordsEditable.substring(0, wordsEditable.length - 1);
    re += "(" + wordsEditable + ")";
    re = "\\b" + re + "\\b" + "|\\s" + re + "\\s";
  }

  if (wordpartsEditable.length > 1 && wordsEditable.length > 1) {
    re += "|";
  }

  if (wordpartsEditable.length > 1) {
    wordpartsEditable = wordpartsEditable.substring(
      0,
      wordpartsEditable.length - 1
    );
    re += "(" + wordpartsEditable + ")";
  }
  matchRegexEditable = re;

  //ContentEditable regex case sensitive
  var re = "";
  if (wordsEditableCS.length > 1) {
    wordsEditableCS = wordsEditableCS.substring(0, wordsEditableCS.length - 1);
    re += "(" + wordsEditableCS + ")";
    re = "\\b" + re + "\\b" + "|\\s" + re + "\\s";
  }

  if (wordpartsEditableCS.length > 1 && wordsEditableCS.length > 1) {
    re += "|";
  }

  if (wordpartsEditableCS.length > 1) {
    wordpartsEditableCS = wordpartsEditableCS.substring(
      0,
      wordpartsEditableCS.length - 1
    );
    re += "(" + wordpartsEditableCS + ")";
  }
  matchRegexEditableCS = re;
  var doMatchRegex = matchRegex.length > 0;
  var doMatchRegexCS = matchRegexCS.length > 0;
  var domatchRegexEditable = matchRegexEditable.length > 0;
  var domatchRegexEditableCS = matchRegexEditableCS.length > 0;

  return {
    matchRegex: matchRegex,
    matchRegexCS: matchRegexCS,
    matchRegexEditable: matchRegexEditable,
    matchRegexEditableCS: matchRegexEditableCS,
    doMatchRegex: doMatchRegex,
    doMatchRegexCS: doMatchRegexCS,
    domatchRegexEditable: domatchRegexEditable,
    domatchRegexEditableCS: domatchRegexEditableCS,
  };
}

function getBorderColors() {
  //do the http request to get the border colors
  var data = new FormData();
  data.append("Get", "Rating");

  var xhr = new XMLHttpRequest();
  xhr.withCredentials = true;

  xhr.addEventListener("readystatechange", function () {
    if (this.readyState === 4) {
      //console.log(x2js.xml_str2json(this.responseText));
      var jsonResponse = x2js.xml_str2json(this.responseText);
      jsonResponse.data.row.forEach(function (c) {
        borderColors.push(c);
      });
      defaultBordercolor =
        "rgb(" +
        borderColors.filter(function (i) {
          return i.ClrIsDefault == "True";
        })[0].RateBdrClr +
        ")";
    }
  });

  xhr.open("POST", "http://mudpak.org/preloaddata.aspx");

  xhr.send(data);
}

function getKeywords(callback) {
  //do the http request to get the border colors
  var data = new FormData();
  data.append("Get", "KeyWord");

  var xhr = new XMLHttpRequest();
  xhr.withCredentials = true;

  xhr.addEventListener("readystatechange", function () {
    if (this.readyState === 4) {
      var keywords = x2js.xml_str2json(this.responseText);
      var words = [];

      keywords.data.row.forEach(function (w) {
        words.push(w);
      });
      callback(words);
    }
  });

  xhr.open("POST", "http://mudpak.org/preloaddata.aspx");

  xhr.send(data);
}

function submitAllKeywords(allKeywords, callback) {
  var data = new FormData();
  //data.append("SP", "sp_InsertOnLoad");
  data.append("LoadArray", allKeywords);
  var xhr = new XMLHttpRequest();
  xhr.addEventListener("readystatechange", function () {
    if (this.readyState === 4) {
      callback(this.responseText);
    }
  });

  xhr.open("POST", "http://mudpak.org/insertbulkrecord.aspx");

  xhr.send(data);
}

function submitKeyword(object, callback) {
  var data = new FormData();
 // data.append("SP", "sp_InsertOnClick");
data.append("InsertBulkID", object.KeyWordFieldID);

  data.append("ProgID", object.ProgID);
  data.append("PageCurrentURL", object.PageCurrentURL);
  data.append("PageProcIndex", object.PageProcIndex);
  data.append("DomName", object.DomName);
  data.append("CatName", object.CatName);
  data.append("KeyWordVal", object.KeyWordVal);
  data.append("KeyWordRateVal", object.KeyWordRateVal);
  data.append("KeyWordFieldID", object.KeyWordFieldID);

  if ("ClickPurpose" in object && object.ClickPurpose == "RATE") {
    data.append("ClickPurpose", object.ClickPurpose);
    data.append("ClickComments", "");
  }

  let KeyWordSrvGUID = getKeyWordSrvGUID(object);
  if (KeyWordSrvGUID) data.append("KeyWordSrvGUID", KeyWordSrvGUID);

  var xhr = new XMLHttpRequest();
  xhr.addEventListener("readystatechange", function () {
    if (this.readyState === 4) {
      callback(this.responseText);
    }
  });

  xhr.open("POST", "http://mudpak.org/insertrecord.aspx");

  xhr.send(data);
}

function getKeyWordSrvGUID(object) {
  let { PageCurrentURL, DomName, CatName, selector, KeyWordVal } = object;
  let foundItem = automationData.find(
    (item) =>
      item.PageCurrentURL == PageCurrentURL &&
      item.selector == selector &&
      item.KeyWordVal == KeyWordVal
  );
  if (!foundItem) return null;
  let { KeyWordSrvGUID } = foundItem;
  return KeyWordSrvGUID;
}

function log(str) {
  console.log(str);
}

function globStringToRegex(str) {
  str = str.replace(/[-[\]{}()*+?.,\\^$|]/g, "\\$&");
  return preg_quote(str).replace(/\*/g, "S*").replace(/\\\?/g, ".");
}

function preg_quote(str, delimiter) {
  // http://kevin.vanzonneveld.net
  // +   original by: booeyOH
  // +   improved by: Ates Goral (http://magnetiq.com)
  // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // +   bugfixed by: Onno Marsman
  // +   improved by: Brett Zamir (http://brett-zamir.me)
  // *     example 1: preg_quote("$40");
  // *     returns 1: '\$40'
  // *     example 2: preg_quote("*RRRING* Hello?");
  // *     returns 2: '\*RRRING\* Hello\?'
  // *     example 3: preg_quote("\\.+*?[^]$(){}=!<>|:");
  // *     returns 3: '\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:'
  //return str;
  return (str + "").replace(
    new RegExp(
      "/^.*[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\" + (delimiter || "") + "-].*$/",
      "g"
    ),
    "\\$&"
  );
}

function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}
