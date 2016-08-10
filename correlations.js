let options = {
  'channel': {
    value: null,
    type: 'option',
  },
};

function getOption(name) {
  return options[name].value;
}

function getOptionType(name) {
  return options[name].type;
}

function setOption(name, value) {
  return options[name].value = value;
}

let onLoad = new Promise(function(resolve, reject) {
  window.onload = resolve;
});

function getCorrelations(signature) {
  let image = document.getElementById('correlations_image');
  image.title = signature + ' correlations.';
  image.src = 'plots/' + getOption('channel') + '/' + signature + '.png';
  image.width = 1200;
  image.height = 900;
}

onLoad
.then(function() {
  Object.keys(options)
  .forEach(function(optionName) {
    let optionType = getOptionType(optionName);
    let elem = document.getElementById(optionName);

    if (optionType === 'select') {
      setOption(optionName, elem.checked);

      elem.onchange = function() {
        setOption(optionName, elem.checked);
      };
    } else if (optionType === 'option') {
      setOption(optionName, elem.options[elem.selectedIndex].value);

      elem.onchange = function() {
        setOption(optionName, elem.options[elem.selectedIndex].value);
      };
    } else if (optionType === 'button') {
      setOption(optionName, elem.value);

      document.getElementById(optionName + 'Button').onclick = function() {
        setOption(optionName, elem.value);
      };
    } else {
      throw new Error('Unexpected option type.');
    }
  });
})
.then(function() {
  document.getElementById('go').onclick = function() {
    getCorrelations(document.getElementById('signature').value);
  };
})
.catch(function(err) {
  console.error(err);
});
