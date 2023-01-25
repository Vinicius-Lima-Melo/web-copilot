wcLog("webcopilot.js");
wcLog("running...");

chrome.storage.sync.get(["WC_autocomplete", "WC_show_suggestions"], function (items) {
  // console.log("items", items);
  wcLog("WC_items", items)
  if(items.WC_autocomplete) {
    wcLog("Searching for inputs... ")
    let interval = setInterval(() => {
      if(document.querySelectorAll("input").length !== 0){
        wcLog(document.querySelectorAll("input").length+" Inputs found! ")
        clearInterval(interval);
        executeScript();
      }
    }, 500)
    // setTimeout(() => {
    //   executeScript();
    // }, 1000);
  }
  else{
    wcLog("WC_autocomplete is disabled")
  }
});


function executeScript(){
  wcLog("executing script...")

  document.querySelectorAll("input").forEach((element) => {

    let webcopilot_label = element.getAttribute("web-copilot");

    if (webcopilot_label === null || webcopilot_label === "") return;

    element.style.borderColor = "#f6c231";
    element.value = getCorrespondingValue(webcopilot_label+'s')

  });

  function getCorrespondingValue(label) {
    switch (label) {
      case "userNames":
        return chance.name();
      case "telefones":
        return chance.phone();
      case "ceps":
        return chance.zip();
      case "cpfs":
        return chance.cpf();
      default:
        return "";
    }
  }

  
}

function wcLog(msg){
    console.log('%c WC > %c'+msg, 'color:#f6c231', 'color:#c1c1c1');
    return
  }