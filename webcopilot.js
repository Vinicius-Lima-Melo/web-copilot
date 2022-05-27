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
  ceps:{
    [0]: "18044-200",    
    [1]: "60731-280",    
    [2]: "24913-505",    
    [3]: "49020-085",
  },
  cpfs:{
    [0]: "351.936.550-25",    
    [1]: "750.061.420-90",    
    [2]: "946.404.840-97",    
    [3]: "340.310.780-99",
  }
}

document.querySelectorAll('input').forEach( input => {
  let el = input
  let index = Math.floor(Math.random() * 4)

  input.value = types[el.ariaLabel+'s'][index]
});
