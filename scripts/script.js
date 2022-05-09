chrome.runtime.onMessage.addListener(function(request, sender) {
  if (request.action == "getSource") {
    message.innerText = request.source;
  }
});

function onWindowLoad() {

  var message = document.querySelector('#message');

  chrome.scripting.executeScript({
    file: "getPagesSource.js"
  }, function() {
    // If you try and inject into an extensions page or the webstore/NTP you'll get an error
    if (chrome.runtime.lastError) {
      message.innerText = 'There was an error injecting script : \n' + chrome.runtime.lastError.message;
    }
  });

}

window.onload = onWindowLoad;

// chrome.runtime.onMessage.addListener(function(request, sender) {
//   if (request.action == "getSource") {
//       this.pageSource = request.source;
//       var title = this.pageSource.match(/<title[^>]*>([^<]+)<\/title>/)[1];
//       alert(title)
//   }
// });

// chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
//   chrome.tabs.executeScript(
//       tabs[0].id,
//       { code: 'var s = document.documentElement.outerHTML; chrome.runtime.sendMessage({action: "getSource", source: s});' }
//   );
// });
// var myScript = document.createElement('script');
// // myScript.textContent = 'messageOpen(15, false);';
// console.log(myScript)
// document.head.appendChild(myScript);

// chrome.tabs.update(tab.id, {active: true});

// Execute code on the existing tab to open the Message.
// chrome.tabs.executeScript(tab.id, {
//     "code": "var myScript = document.createElement('script');"
//         + "myScript.textContent = 'messageOpen(15, false);';"
//         + "document.head.appendChild(myScript);"
// });




// // const log = chrome.extension.getBackgroundPage()
// // console.log("Running script.js", chrome);

// // chrome.tabs.onUpdated.addListener( function (tabId, changeInfo, tab) {
// //     alert("Tab updated");
// //     if (changeInfo.status == 'complete') {
  
// //       // do your things
  
// //     }
// //   })

// let color = '#3aa757';

// chrome.runtime.onInstalled.addListener(() => {
// //   chrome.storage.sync.set({ color });
//   console.log('Default background color set to %cgreen', `color: ${color}`);
// });

// alert("Running script.js");