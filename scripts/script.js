$(document).ready(function () {
    chrome.storage.sync.get(["WC_autocomplete", "WC_show_suggestions"], function (items) {
        $('#WC_autocomplete').prop('checked', items.WC_autocomplete);
        $('#WC_show_suggestions').prop('checked', items.WC_show_suggestions);
    });
})

$(document).on('change', '#WC_show_suggestions', function(e) {
    const {checked} = e.target
    chrome.storage.sync.set({WC_show_suggestions: checked});
    alert("Atualize a página para aplicar as alterações")
}); 

$(document).on('change', '#WC_autocomplete', function(e) {
    const {checked} = e.target
    chrome.storage.sync.set({WC_autocomplete: checked});
    alert("Atualize a página para aplicar as alterações")
}); 
