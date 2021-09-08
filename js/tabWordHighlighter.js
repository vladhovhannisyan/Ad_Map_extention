var wordsArray = [];
var regexConfig = {};
var skipSelectors = "";
var ReadyToFindWords = true; //indicates if not in a highlight execution
var Config = {
  highlightLoopFrequency: 1000,
  //highlightWarmup: 300,
  fixedLoopTime: false,
  increaseLoop: 500,
  decreaseLoop: 50,
  maxLoopTime: 2500,
  minLoopTime: 500,
  highlightAtStart: false,
  updateOnDomChange: false,
};
var environment = {};

chrome.runtime.sendMessage(
  {
    command: "getEnvironment",
  },
  function (response) {
    debug && console.log("got words");
    environment = response;
  }
);

var borderColors = [];
var Highlight = true; // indicates if the extension needs to highlight at start or due to a change. This is evaluated in a loop
var HighlightLoopFrequency = 1000; // the frequency of checking if a highlight needs to occur
//var HighlightWarmup=300; // min time to wait before running a highlight execution

var HighlightLoop;

var watchedElements = [];

var alreadyNotified = false;
var wordsReceived = false;
var highlighterEnabled = true;
var searchEngines = {
  "google.com": "q",
  "bing.com": "q",
};
var markerCurrentPosition = -1;
var markerPositions = [];
var highlightMarkers = {};
var markerScroll = false;
var printHighlights = true;

var debugStats = { findCount: 0, loopCount: 0, subTreeModCount: 0 };
var debug = false;

if (window.location == window.parent.location) {
  //only listen for messages in the main page, not in iframes since they load the extension too
  chrome.runtime.onMessage.addListener(function (
    request,
    sender,
    sendResponse
  ) {
    debug && console.log("got a message", request);
    return true;
  });
} else {
  debug && console.log("not in main page", window.location);
}

function jumpNext() {
  if (
    markerCurrentPosition == markerPositions.length - 1 ||
    markerCurrentPosition > markerPositions.length - 1
  ) {
    markerCurrentPosition = -1;
  }
  markerCurrentPosition += 1;
  $(window).scrollTop(
    markerPositions[markerCurrentPosition] - window.innerHeight / 2
  );
}

function showMarkers() {
  var element = document.getElementById("HighlightThisMarkers");
  if (element) {
    element.parentNode.removeChild(element);
  }

  var containerElement = document.createElement("DIV");
  containerElement.id = "HighlightThisMarkers";

  for (marker in highlightMarkers) {
    var span = document.createElement("SPAN");
    span.className = "highlightThisMarker";
    span.style.backgroundColor = "#0091EA"; //highlightMarkers[marker].color;
    var markerposition =
      document.body.scrollTop +
      (highlightMarkers[marker].offset / document.body.clientHeight) *
        window.innerHeight;
    span.style.top = markerposition + "px";
    containerElement.appendChild(span);
  }
  document.body.appendChild(containerElement);
  if (!markerScroll) {
    document.addEventListener("scroll", function () {
      showMarkers();
    });
    markerScroll = true;
  }
}

function reHighlight(words, impactedClass) {
  addStylesToPage(words.styles);
  //TODO : remove all highlight classes
  if (impactedClass) {
    Highlight = false;
    ReadyToFindWords = false;
    debug && console.log("removing highlights for class ", impactedClass);
    var myHilighter = new HighlightEngine();
    myHilighter.removeHighlightForClass(impactedClass);
    ReadyToFindWords = true;
  }
  wordsArray = words.words;
  regexConfig = words.regex;
  skipSelectors = words.skipSelectors;
  findWords(true);
}

chrome.runtime.sendMessage(
  {
    command: "getBorderColors",
  },
  function (response) {
    borderColors = response;
  }
);

chrome.runtime.sendMessage(
  {
    command: "getWords",
    url: location.href.replace(location.protocol + "//", ""),
  },
  function (response) {
    debug && console.log("got words");
    //addStylesToPage(response.words.styles);
    wordsArray = response.words;
    regexConfig = response.regex;
    skipSelectors = response.skipSelectors;
    debug && console.log("processed words");
    wordsReceived = true;

    //start the highlight loop
    highlightLoop();
  }
);
/*
    }
});*/

$(document).ready(function () {
  Highlight = true;
  showPanelNew();
  disableLinkClick();
  // showSubmitButton();
  debug && console.log("setup binding of dom sub tree modification");
  if (Config.updateOnDomChange) {
    //setup the mutationobjserver

    // select the target node
    var target = document.querySelector("body");

    // create an observer instance
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (addedNode) {
          if (addedNode.tagName == "INPUT") {
            attachChangeEvent(addedNode);
          }
        });
        debug && console.log(mutation);
      });
      debug && (debugStats.subTreeModCount += 1);
      Highlight = true;
    });

    // configuration of the observer:
    var config = {
      attributes: false,
      childList: true,
      characterData: true,
      subtree: true,
    };

    // pass in the target node, as well as the observer options
    observer.observe(target, config);
  }

  document.querySelectorAll("input,textarea,select").forEach((element) => {
    attachChangeEvent(element);
  });
});

function attachChangeEvent(element) {
  if (!watchedElements.indexOf(element) > -1) {
    watchedElements.push(element);
    element.addEventListener("change", function (element) {
      Highlight = true;
    });
  }
}

function highlightLoop() {
  ReadyToFindWords = true;
  debug && console.log("in loop", debugStats);
  if (Highlight) {
    findWords();
    //calucate new HighlightLoopFrequency
    if (!Config.fixedLoopTime && HighlightLoopFrequency < Config.maxLoopTime) {
      HighlightLoopFrequency += Config.increaseLoop;
    }
  } else {
    if (!Config.fixedLoopTime && HighlightLoopFrequency > Config.minLoopTime) {
      HighlightLoopFrequency -= Config.decreaseLoop;
    }
  }

  debug && (debugStats.loopCount += 1);
  debug && console.log("new loop frequency", HighlightLoopFrequency);

  HighlightLoop = setTimeout(function () {
    highlightLoop();
  }, HighlightLoopFrequency);
}

function getSearchKeyword() {
  var searchKeyword = null;
  if (document.referrer) {
    for (searchEngine in searchEngines) {
      if (document.referrer.indexOf(searchEngine)) {
        searchKeyword = getSearchParameter(searchEngines[searchEngine]);
      }
    }
  }
  return searchKeyword;
}
function getSearchParameter(n) {
  var half = document.referrer.split(n + "=")[1];
  return half !== undefined ? decodeURIComponent(half.split("&")[0]) : null;
}

function findWords(force = false) {
  if (Object.keys(wordsArray).length > 0) {
    Highlight = false;
    //window.alert('POC running')
    debug && console.log("finding words", window.location);

    ReadyToFindWords = false;

    var changed = false;
    var myHilighter = new HighlightEngine();

    regexConfig.removeStrings = "";

    var loopNumber = Math.floor(Math.random() * 1000000000);
    var highlights = myHilighter.highlight(
      wordsArray,
      printHighlights,
      regexConfig,
      skipSelectors,
      loopNumber,
      force
    );
    if (highlights.numberOfHighlights > 0) {
      highlightMarkers = highlights.markers;
      markerPositions = [];
      for (marker in highlightMarkers) {
        if (markerPositions.indexOf(highlightMarkers[marker].offset) == -1) {
          markerPositions.push(highlightMarkers[marker].offset);
        }
      }
      markerPositions.sort();

      /*       chrome.runtime.sendMessage({
                command: "showHighlights",
                count: highlights.numberOfHighlights,
                url: document.location.href
            }, function (response) {
            });
            if((!alreadyNotified | highlights.notifyAnyway)& highlights.notify.length>0){
                alreadyNotified=true;
                var notificationWords=''; 
                for (var notification in highlights.notify){
                    notificationWords+=(highlights.notify[notification])+', ';
                }
                chrome.runtime.sendMessage({
                    command: "notifyOnHighlight", forced: highlights.notifyAnyway
                }, function (response) {});
            }*/
    }
    debug && console.log("finished finding words");
    debug && (debugStats.findCount += 1);

    ReadyToFindWords = true;
    //}, HighlightWarmup);
  }
}

function addStylesToPage(styles) {
  if ($("#highlighThisCSS").length == 0) {
    $("head").append(
      '<style type="text/css" id="highlighThisCSS">' + styles + "</style>"
    );
  } else {
    $("#highlighThisCSS").html(styles);
  }
}

function globStringToRegex(str) {
  return preg_quote(str).replace(/\\\*/g, "\\S*").replace(/\\\?/g, ".");
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
  return (str + "").replace(
    new RegExp(
      "[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\" + (delimiter || "") + "-]",
      "g"
    ),
    "\\$&"
  );
  //return str;
}

function clickHandler(e) {
  try {
    var match = e.getAttribute("match");
    //find my word
    var wordConfig = $.grep(wordsArray, function (obj) {
      return obj.word === match;
    })[0];

    //testing purpose
    if (wordConfig) {
      if (wordConfig.action.type == 99) {
        //set border
        var nextBorder = nextBorderColor(
          e.style.border.replace("2px solid ", "")
        );
        e.style.border = "2px solid " + nextBorder.color;

        //send value to backend
        word = wordsArray.find((word) => word.word == e.getAttribute("match"));
        let selector = finder(e);
        requestObject = {
InsertBulkID: word.id, //word.id,
          ProgID: word.ProgID,
          PageCurrentURL: window.location.href,
          PageProcIndex: 1, //word.id,
          DomName: word.DomName,
          CatName: word.CatName,
          KeyWordVal: word.word,
          KeyWordRateVal: nextBorder.score,
          KeyWordFieldID: 1, //word.id
          selector,
        };

        changeTreeTextColor(nextBorder.color, selector);
        if (findElementInTree(selector)) requestObject["ClickPurpose"] = "RATE";

        chrome.runtime.sendMessage(
          {
            command: "submitKeyword",
            requestObject: requestObject,
          },
          function (response) {
            console.log(response);
          }
        );
      }
    }
  } catch (c) {}
}

function nextBorderColor(currentBorder) {
  var c = 0;
  for (var c in borderColors) {
    if ("rgb(" + borderColors[c].RateBdrClr + ")" == currentBorder) {
      if (borderColors.length == Number(c) + 1) {
        return {
          color: "rgb(" + borderColors[0].RateBdrClr + ")",
          score: borderColors[0].RateNumScore,
        };
      } else {
        return {
          color: "rgb(" + borderColors[Number(c) + 1].RateBdrClr + ")",
          score: borderColors[Number(c) + 1].RateNumScore,
        };
      }
    }
  }
}

function changeTreeTextColor(borderColor, selector) {
  let el = findElementInTree(selector);
  if (el) el.style.color = borderColor;
}

function findElementInTree(selector) {
  return [...document.querySelectorAll(".tree-leaf-content")].find((el) => {
    let obj = JSON.parse(el.dataset.item);
    return obj?.selector == selector;
  });
}

function showPanelNew() {
  adjustBodyContent();
  createPanel();
}

var panelSize = 300;
function createPanel() {
  $('<div id="RegenPlugin" />').prependTo("body");
  $("#RegenPlugin").fadeIn("slow", function () {
    document.body.style.marginLeft =
      Number(document.body.style.marginLeft.replace("px", "")) +
      panelSize +
      "px";
  });
}

function adjustBodyContent() {
  $("*").each(function () {
    let isPositionFixed = $(this).css("position") === "fixed";
    let isPostionLeftZero = $(this).css("left").replace("px", "") < 1;
    if (isPositionFixed && isPostionLeftZero) {
      $(this).css("left", '"+panelSize+"px');
    }
  });
}

function showSubmitButton() {
  document.head.insertAdjacentHTML(
    "beforeend",
    `<style>#myBtn:hover{background-color:green !important}</style>`
  );

  const submitBtn = document.createElement("button");

  submitBtn.innerText = "Submit All";
  submitBtn.id = "myBtn";
  submitBtn.style.position = "fixed";
  submitBtn.style.bottom = "5px";
  submitBtn.style.right = "5px";
  submitBtn.style.border = "1px solid black";
  submitBtn.style.color = "#fff";
  submitBtn.style.backgroundColor = "red";
  submitBtn.style.padding = `5px 10px`;

  submitBtn.addEventListener("click", submitAllKeywords);
  document.body.append(submitBtn);
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.msg == "send_keywords") {
    let allKeywords = getAllKeywords();
    chrome.runtime.sendMessage({
      allKeywords,
      msg: "recieved_keywords",
    });
  }
});

function getAllKeywords() {
  let matches = [...document.querySelectorAll(".RegenPoc")].map((e) => {
    return {
      match: e.getAttribute("match"),
      selector: finder(e),
    };
  });

  let wordstoProcess = [];

  matches.forEach(({ match, selector }) => {

    let foundWord = wordsArray.find(item => item.word == match)
    if(!foundWord) return;
    wordstoProcess.push( {
      ...foundWord,
      selector
    });

    /* var wordConfigArray = $.grep(wordsArray, function (obj) {
      return obj.word === match;
    });

    if (wordConfigArray.length == 0) return;
    wordConfigArray.forEach((wordConfig) => {
      if (wordConfig && wordConfig.action.type == 99) {
        let wordInfo = wordsArray.find((word) => word.word == match);
        wordInfo.selector = selector;
        wordstoProcess.push(wordInfo);
      }
    }); */
  });

  return wordstoProcess;
}

function disableLinkClick() {
  document.querySelectorAll("a").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  document.querySelectorAll("[data-link]").forEach((el) => {
    el.setAttribute("data-link", "");
  });
}


/* 
function submitAllKeywords() {
  let currentLocation = window.location.href;

  let matches = [...document.querySelectorAll(".RegenPoc")].map((e) => {
    return {
      match: e.getAttribute("match"),
      selector: finder(e),
    };
  });

  let wordstoProcess = [];

  matches.forEach(({ match, selector }) => {
    var wordConfig = $.grep(wordsArray, function (obj) {
      return obj.word === match;
    })[0];

    //testing purpose
    if (wordConfig && wordConfig.action.type == 99) {
      let wordInfo = wordsArray.find((word) => word.word == match);
      wordInfo.selector = selector;
      wordstoProcess.push(wordInfo);
    }
  });

  let semiColonDelimeter = wordstoProcess.map(
    ({ InsertBulkID, ProgID, DomName, CatName, borderColor, word, id }) => {
      const score = nextBorderColor(borderColor).score;
      return `sp_InsertOnLoad;${id};${ProgID};${currentLocation};1;${DomName};${CatName};${word};-1;${id}`;
    }
  );
  let allKeywords = semiColonDelimeter.join("|||");
  chrome.runtime.sendMessage(
    {
      command: "submitAllKeywords",
      allKeywords,
    },
    function (response) {
      console.log(response);
    }
  );
}
 */