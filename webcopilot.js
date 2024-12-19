wcLog("webcopilot.js");
wcLog("running...");


// const fk = new faker({
//   locale: 'pt_BR'
// })
faker.locale = 'pt_BR'
faker.localeFallback = 'pt_BR'

console.log(faker)



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
        return faker.name.firstName() +' '+faker.name.lastName() 
      case "telefones":
        return faker.phone.phoneNumber().replace(/^'+55'+/i, '');
      case "ceps":
        return faker.address.zipCode();
      case "cpfs":
        return gerarCpf();
      case "enderecoCompletos":
          return faker.address.streetName()+', '+ faker.random.number()+', '+"CENTRO, "+faker.address.city()+' - '+faker.address.stateAbbr();
      case "ruas":
          return faker.address.streetName();
      case "bairros":
        return "CENTRO";
      case "estados":
        return faker.address.state();
      case "cidades":
        return faker.address.city();
      default:
        return "";
    }
  }

  
}


function wcLog(msg){
  console.log('%c WC > %c'+msg, 'color:#f6c231', 'color:#c1c1c1');
  return
}


function gerarCpf() {
  const num1 = aleatorio();
  const num2 = aleatorio();
  const num3 = aleatorio();

  const dig1 = dig(num1, num2, num3); 
  const dig2 = dig(num1, num2, num3, dig1); 
  return `${num1}.${num2}.${num3}-${dig1}${dig2}`;
}

function dig(n1, n2, n3, n4) { 
  const nums = n1.split("").concat(n2.split(""), n3.split(""));
  
  if (n4 !== undefined){
    nums[9] = n4;
  }
  
  let x = 0;
  for (let i = (n4 !== undefined ? 11:10), j = 0; i >= 2; i--, j++) {
    x += parseInt(nums[j]) * i;
  }
  
  const y = x % 11;
  return y < 2 ? 0 : 11 - y; 
}

function aleatorio() {
  const aleat = Math.floor(Math.random() * 999);
  return ("" + aleat).padStart(3, '0'); 
}
