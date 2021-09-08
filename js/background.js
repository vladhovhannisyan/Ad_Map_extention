let sitemapUrls = [];
let url_index = 0;
let generator;
let activeTabId;
let timeoutId;
let automationData = [];
let treeDetails = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // if (request.msg == "sitemap") {
  //    crowl(request.url) 
  // }
  // crowl(request.url)


  if (request.msg == "sitemap") {
    runAutomation(request.url);
    console.log(11111);
  } 
  else if (request.msg == "recieved_keywords") {
    // formatAndSubmit({ allKeywords: request.allKeywords, url: sender.url });
    // console.log(2222);
  } 
  else if (request.msg == "send_tree_value") {
    submitTreeValue(request.requestObject, sendResponse);
    console.log(33333);
  } 
  else if (request.msg == "GET_TREE_DATA") {
    console.log(44444);

    let treeItem = treeDetails.find((item) => item.currentUrl == sender.url);
    if (treeItem) {
      let { treeData } = treeItem;
      sendResponse(treeData);
    }

  }

});


function crowl (url){
  var data = null;

  var xhr = new XMLHttpRequest();
  xhr.withCredentials = true;

  xhr.addEventListener("readystatechange", function () {
    if (this.readyState === 4) {
      console.log(11111111111, this.responseText);
    }
  });

  xhr.open("POST", "http://mudpak.org/preloaddata.aspx?get=KeyWord");
  xhr.setRequestHeader("cache-control", "no-cache");

  xhr.send(data);
} 

function getKeywordAutomationInfo(object) {
  let { PageCurrentURL, selector, KeyWordVal } = object;
  let foundItem = automationData.find(
    (item) =>
      item.PageCurrentURL == PageCurrentURL &&
      item.selector == selector &&
      item.KeyWordVal == KeyWordVal
  );

  return foundItem;
}

function submitTreeValue(object, callback) {
  var data = new FormData();

  let keywordInfo = getKeywordAutomationInfo(object);
  if (!keywordInfo) return;
  data.append("SP", "sp_UpdateClickPurposeOnClick");
  data.append("KeyWordVal", keywordInfo.KeyWordVal);
  data.append("KeyWordFieldID", keywordInfo.KeyWordFieldID);
  data.append("KeyWordSrvGUID", keywordInfo.KeyWordSrvGUID);
  data.append("ClickPurpose", "NAV");
  data.append("ClickComments", "");  
  var xhr = new XMLHttpRequest();
  xhr.addEventListener("readystatechange", function () {
    if (this.readyState === 4) {
      callback(this.responseText);
    }
  });

  xhr.open("POST", "http://mudpak.org/updateclickpurpose.aspx");

  xhr.send(data);
}
function* sitemapUrlGenerator() {
  while (url_index < sitemapUrls.length) {
    yield sitemapUrls[url_index];
    url_index++;
  }
}

async function getJsFromUrl(sitemapUrl) {
  var formData = new FormData();
  formData.append("SiteXMLURL", sitemapUrl);
  const response = await fetch("http://mudpak.org/preloadsitemap.aspx", {
    method: "POST",
    body: formData,
  });

  
  const data = await response.text();

  // console.log(' -- data', data);

  var x2js = new X2JS();
  var {
    urlset: { url: urls },
  } = x2js.xml_str2json(data);

  return urls.map((item) => item.loc);
}

function openUrl({ value: url }) {
  if (!activeTabId || !url) {
    stopTimeout();
    return;
  }
  chrome.tabs.update(activeTabId, { url }, sendMessageForKeywords);
}

function sendMessageForKeywords() {
  timeoutId = setTimeout(() => {
    if (!activeTabId) {
      stopTimeout();
      return;
    }
    chrome.tabs.sendMessage(activeTabId, { msg: "send_keywords" });
  }, 5000);
}

function stopTimeout() {
  if (timeoutId) clearTimeout(timeoutId);
}

function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}
function formatAndSubmit(obj) {
  const { url, allKeywords } = obj;      
  let semiColonDelimeter = allKeywords.map((keyword) => {
    let {
      ProgID,
      DomName,
      CatName,
      word,
      ClickPurpose = "Load",
      ClickComments = "",
    } = keyword;
    let id = uuidv4();
    let keywordInfo = {
      ...keyword,
      KeyWordFieldID: id,
      PageCurrentURL: url,
      KeyWordVal: word,
      ClickPurpose,
      ClickComments
    };
    saveAutomationData(keywordInfo);

    return `sp_InsertOnLoad;${id};${ProgID};${url};${url_index};${DomName};${CatName};${word};-1;${id};${ClickPurpose};${ClickComments};`;
  });
  console.log(semiColonDelimeter)
  let result = semiColonDelimeter.join("|||");
  submitToServer(result);

  openUrl(generator.next());
}

function submitToServer(allKeywords) {
  var data = new FormData();
  data.append("SP", "LOAD");
  data.append("LoadArray", allKeywords);
  var xhr = new XMLHttpRequest();
  xhr.addEventListener("readystatechange", function () {
    if (this.readyState === 4) {
      let jsonData = xmlToJson(this.responseText);
      updateAutomationData(jsonData);
      console.log(jsonData)
    }
  });

  xhr.open("POST", "http://mudpak.org/insertbulkrecord.aspx");

  xhr.send(data);
}

async function runAutomation(sitemapUrl) {
  url_index = 0;
  sitemapUrls = await getJsFromUrl(sitemapUrl);

  console.log(' -- sitemapUrls', sitemapUrls);
  

  generator = sitemapUrlGenerator();
  chrome.tabs.create({}, (tab) => {
    activeTabId = tab.id;
    openUrl(generator.next());
  });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeTabId == tabId) activeTabId = null;
});

function xmlToJson(data) {
  var x2js = new X2JS();
  return x2js.xml_str2json(data);
}

function doesKeywordExist(keywordInfo) {
  return automationData.find(
    (item) =>
      keywordInfo.PageCurrentURL == item.PageCurrentURL &&
      keywordInfo.selector == item.selector &&
      keywordInfo.KeyWordVal == item.KeyWordVal
  );
}

function saveAutomationData(keywordInfo) {
  if (doesKeywordExist(keywordInfo)) return;
  automationData.push(keywordInfo);
  updateTree(keywordInfo);  
}

function findAndUpdate(detail) {
  let { KeyWordSrvGUID, KeyWordFieldID, KeyWordVal } = detail;  

  automationData.forEach((keywordInfo) => {
    if (keywordInfo.KeyWordFieldID == KeyWordFieldID) {
      keywordInfo["KeyWordSrvGUID"] = KeyWordSrvGUID;
    }
  });
}

function updateAutomationData(serverResponse) {
  let {
    data: { ReturnXML },
  } = serverResponse;
  if (!ReturnXML || ReturnXML.length == 0) return;  
  // ReturnXML can be object or array of Objects
  if (Array.isArray(ReturnXML)) ReturnXML.forEach(findAndUpdate);
  else findAndUpdate(ReturnXML);
}

function updateTree(keywordInfo) {
  let obj = treeDetails.find(
    (item) => item.currentUrl == keywordInfo.PageCurrentURL
  );
  if (!obj) {
    obj = { currentUrl: keywordInfo.PageCurrentURL, treeData: [] };
    treeDetails.push(obj);
  }
  let { treeData } = obj;
  createTree(keywordInfo, treeData);
}

const LEVELS = ["DomName", "CatName", "KeyWordVal"];

function createTree(obj, searchArray, level = 0) {
  let keyName = LEVELS[level];
  let root = obj[keyName];
  let rootIndex = searchArray.findIndex((item) => root == item.name);
  if (rootIndex == -1) {
    rootIndex = searchArray.push({
      name: root,
      children: [],
    });
  }
  rootIndex = searchArray.findIndex((item) => root == item.name);
  level++;
  if (LEVELS.length == level) {
    searchArray[rootIndex].selector = obj.selector;
    return;
  }

  createTree(obj, searchArray[rootIndex].children, level);
}
