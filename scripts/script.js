$(document).ready(function () {
    chrome.storage.sync.get(["WC_autocomplete", "WC_show_suggestions", "WC_need_reload"], function (items) {
        $('#WC_autocomplete').prop('checked', items.WC_autocomplete);
        $('#WC_show_suggestions').prop('checked', items.WC_show_suggestions);
        $('#btn_refresh').prop('disabled', !items.WC_need_reload);
    });
})

$(document).on('change', '#WC_show_suggestions', function(e) {
    const {checked} = e.target
    chrome.storage.sync.set({WC_show_suggestions: checked});
    chrome.storage.sync.set({WC_need_reload: true});
     $('#btn_refresh'). prop('disabled', false)
    // alert("Atualize a página para aplicar as alterações")
}); 

$(document).on('change', '#WC_autocomplete', function(e) {
    const {checked} = e.target
    chrome.storage.sync.set({WC_autocomplete: checked});
    chrome.storage.sync.set({WC_need_reload: true});
    // alert("Atualize a página para aplicar as alterações")
     $('#btn_refresh'). prop('disabled', false)
});

$(document).on('click', '#btn_refresh', function(e) {
    chrome.storage.sync.set({WC_need_reload: false});
    location.reload();
}); 

