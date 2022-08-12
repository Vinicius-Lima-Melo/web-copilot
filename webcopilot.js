console.log("WC - webcopilot.js");
console.log("WC > running...");




chrome.storage.sync.get(["WC_autocomplete", "WC_show_suggestions"], function (items) {
  if(items.WC_autocomplete) {
    executeScript();
  }
  else{
    console.log("WC > WC_autocomplete is disabled");
  }
});


function executeScript(){
  let types = {
    userNames: {
      [0]: "Vinicius",
      [1]: "Lucas",
      [2]: "João",
      [3]: "Marcelo",
    },
    telefones: {
      [0]: "(15) 99852-7892",
      [1]: "(11) 99734-2233",
      [2]: "(31) 99059-2301",
      [3]: "(88) 99756-8459",
    },
    ceps: {
      [0]: "18044-200",
      [1]: "60731-280",
      [2]: "24913-505",
      [3]: "49020-085",
    },
    cpfs: {
      [0]: "351.936.550-25",
      [1]: "750.061.420-90",
      [2]: "946.404.840-97",
      [3]: "340.310.780-99",
    },
  };
  
  document.querySelectorAll("input").forEach((element) => {
    if (element.ariaLabel === null || element.ariaLabel === "") return;
    element.style.borderColor = "#0F0";
    let index = Math.floor(Math.random() * 4);
    element.value = types[element.ariaLabel + "s"][index];
  });
}