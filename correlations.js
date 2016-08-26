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
  if (!getOption('channel') || !getOption('signature')) {
    return;
  }

  let url = new URL(location.href);
  url.search = '?channel=' + getOption('channel') + '&signature=' + getOption('signature');
  history.replaceState({}, document.title, url.href);

  let svgElem = document.getElementById('correlations_image');
  correlationGraph(svgElem, 1200, 900, getOption('signature'), getOption('channel'));
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
        let option = queryVar.substring((optionName + '=').length);
        console.log('setOption' + optionName + ' ' + option)
        setOption(optionName, option);
      }
    }

    if (optionType === 'select') {
      if (getOption(optionName)) {
        elem.checked = getOption(optionName);
      }

      setOption(optionName, elem.checked);

      elem.onchange = function() {
        setOption(optionName, elem.checked);
        getCorrelations();
      };
    } else if (optionType === 'option') {
      if (getOption(optionName)) {
        for (let i = 0; i < elem.options.length; i++) {
          if (elem.options[i].value === getOption(optionName)) {
            elem.selectedIndex = i;
            break;
          }
        }
      }

      setOption(optionName, elem.options[elem.selectedIndex].value);

      elem.onchange = function() {
        setOption(optionName, elem.options[elem.selectedIndex].value);
        getCorrelations();
      };
    } else if (optionType === 'button') {
      if (getOption(optionName)) {
        elem.value = getOption(optionName);
      }

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
