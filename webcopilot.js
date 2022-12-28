console.log("WC - webcopilot.js");
console.log("WC > running...");

console.log(chance.zip());

chrome.storage.sync.get(["WC_autocomplete", "WC_show_suggestions"], function (items) {
  console.log("WC > items", items);
  if(items.WC_autocomplete) {
    console.log("WC >Waiting 4 seconds to execute script...")
    setTimeout(() => {
      executeScript();
    }, 4000);
  }
  else{
    console.log("WC > WC_autocomplete is disabled");
  }
});


function executeScript(){
  console.log("WC > executing script...");

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