let btnSubmit = document.querySelector("button");
let sitemapInput = document.querySelector("input");
let modes = document.getElementsByName('mode');
let mode = 'crowl';
  
for(i = 0; i < modes.length; i++) {
    if(modes[i].checked)
      mode = modes[i].value;
}


btnSubmit.addEventListener("click", () => {
  if (sitemapInput.value.length == 0) return;
  chrome.runtime.sendMessage({
    msg: "sitemap",
    url: sitemapInput.value,
    mode: mode
  });
});



