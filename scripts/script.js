$(document).on('change', '#sugestoes', function() {
    localStorage.setItem('sugestoes', $(this).val());
    // console.log("Produto selecionado: "+ $(this).attr('id'));		
}); 