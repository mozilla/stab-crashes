let options = {
  'channel': {
    value: null,
    type: 'option',
  },
  'signature': {
    value: null,
    type: 'button',
  }
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

function getCorrelations() {
  let url = new URL(location.href);
  url.search = '?channel=' + getOption('channel') + '&signature=' + getOption('signature');
  history.replaceState({}, document.title, url.href);

  let image = document.getElementById('correlations_image');
  image.title = signature + ' correlations.';
  image.src = 'plots/' + getOption('channel') + '/' + getOption('signature') + '.png';
}

onLoad
.then(function() {
  let queryVars = new URL(location.href).search.substring(1).split('&');

  Object.keys(options)
  .forEach(function(optionName) {
    let optionType = getOptionType(optionName);
    let elem = document.getElementById(optionName);

    for (let queryVar of queryVars) {
      if (queryVar.startsWith(optionName + '=')) {
        let option = queryVar.substring((optionName + '=').length)
        setOption(optionName, option);
      }
    }

    if (optionType === 'select') {
      setOption(optionName, elem.checked);

      elem.onchange = function() {
        setOption(optionName, elem.checked);
        getCorrelations();
      };
    } else if (optionType === 'option') {
      setOption(optionName, elem.options[elem.selectedIndex].value);

      elem.onchange = function() {
        setOption(optionName, elem.options[elem.selectedIndex].value);
        getCorrelations();
      };
    } else if (optionType === 'button') {
      setOption(optionName, elem.value);

      document.getElementById(optionName + 'Button').onclick = function() {
        setOption(optionName, elem.value);
        getCorrelations();
      };
    } else {
      throw new Error('Unexpected option type.');
    }
  });
})
.then(function() {
  getCorrelations();
})
.catch(function(err) {
  console.error(err);
});
