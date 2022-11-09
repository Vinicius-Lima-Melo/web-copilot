console.log("WC - webcopilot.js");
console.log("WC > running...");

console.log(chance.zip());

chrome.storage.sync.get(["WC_autocomplete", "WC_show_suggestions"], function (items) {
  console.log("WC > items", items);
  if(items.WC_autocomplete) {
    executeScript();
  }
  else{
    console.log("WC > WC_autocomplete is disabled");
  }
});


function executeScript(){
  document.querySelectorAll("input").forEach((element) => {
    if (element.ariaLabel === null || element.ariaLabel === "") return;
    element.style.borderColor = "#f6c231";
    element.value = getCorrespondingValue(element.ariaLabel+'s')
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