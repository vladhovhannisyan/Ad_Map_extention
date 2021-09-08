function delay() {
  return new Promise((resolve) => setTimeout(resolve, 2000));
}

async function InjectPanel(treeData) {
  if (!treeData) return;
  clearInterval(intervalId);
  let tree = new TreeView(treeData, "RegenPlugin");
  await delay();
  tree.on("select", function (e) {
    let {
      data: { selector, name },
    } = e;

    if (selector) {
      document.querySelector(selector).scrollIntoView();
      sendTreeValue(selector, name);
    }
  });
}

function sendTreeValue(selector, name) {
  let requestObject = {
    PageCurrentURL: window.location.href,
    KeyWordVal: name,
    selector,
  };

  chrome.runtime.sendMessage(
    {
      msg: "send_tree_value",
      requestObject,
    },
    function (response) {
      console.log(response);
    }
  );
}

let intervalId = setInterval(() => {
  if (document.querySelector("#RegenPlugin")) {
    chrome.runtime.sendMessage(
      {
        msg: "GET_TREE_DATA",
      },
      InjectPanel
    );
  }
}, 5000);
