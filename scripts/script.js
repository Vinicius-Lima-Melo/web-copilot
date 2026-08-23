document.addEventListener('DOMContentLoaded', function () {
    var autocomplete = document.getElementById('WC_autocomplete');
    var suggestions = document.getElementById('WC_show_suggestions');
    var btnRefresh = document.getElementById('btn_refresh');
    var btnFillNow = document.getElementById('btn_fill_now');

    chrome.storage.sync.get(['WC_autocomplete', 'WC_show_suggestions', 'WC_need_reload'], function (items) {
        autocomplete.checked = !!items.WC_autocomplete;
        suggestions.checked = !!items.WC_show_suggestions;
        btnRefresh.disabled = !items.WC_need_reload;
    });

    function markNeedsReload() {
        chrome.storage.sync.set({ WC_need_reload: true });
        btnRefresh.disabled = false;
    }

    autocomplete.addEventListener('change', function (e) {
        chrome.storage.sync.set({ WC_autocomplete: e.target.checked });
        markNeedsReload();
    });

    suggestions.addEventListener('change', function (e) {
        chrome.storage.sync.set({ WC_show_suggestions: e.target.checked });
        markNeedsReload();
    });

    // Recarrega a ABA ativa (onde o formulário está), não o popup — o popup é
    // só a UI de configuração; era ele que estava sendo recarregado antes, o
    // que não tinha nenhum efeito sobre a página que a gente queria testar.
    btnRefresh.addEventListener('click', function () {
        chrome.storage.sync.set({ WC_need_reload: false });
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) chrome.tabs.reload(tabs[0].id);
            window.close();
        });
    });

    btnFillNow.addEventListener('click', function () {
        var label = btnFillNow.querySelector('span');
        var original = label.textContent;

        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (!tabs[0]) return;
            chrome.tabs.sendMessage(tabs[0].id, { type: 'WC_FILL_NOW' }, function (response) {
                if (chrome.runtime.lastError || !response) {
                    label.textContent = 'Abra uma página com formulário';
                } else {
                    label.textContent = response.count + ' campo(s) preenchido(s)';
                }
                setTimeout(function () { label.textContent = original; }, 1800);
            });
        });
    });
});
