// const log = chrome.extension.getBackgroundPage()
// console.log("Running script.js", chrome);

// chrome.tabs.onUpdated.addListener( function (tabId, changeInfo, tab) {
//     alert("Tab updated");
//     if (changeInfo.status == 'complete') {
  
//       // do your things
  
//     }
//   })

let color = '#3aa757';

chrome.runtime.onInstalled.addListener(() => {
//   chrome.storage.sync.set({ color });
  console.log('Default background color set to %cgreen', `color: ${color}`);
});

alert("Running script.js");