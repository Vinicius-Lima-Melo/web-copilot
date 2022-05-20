// document.getElementsByTagName('body')[0].append('<div style="background: blue; border: 1px solid blue"></div>');
// document.getElementsByTagName('h1')[0].innerHTML = 'WebCopilot';

document.querySelectorAll('input').forEach( input => {
  input.addEventListener('keyup', function(e) {
      console.log("extension > ", e.target.value);
  })
});
