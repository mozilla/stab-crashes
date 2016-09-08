let options = {
  'beta1': {
    value: null,
    type: 'option',
  },
  'beta2': {
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

function getComparison() {
  if (!getOption('beta1') || !getOption('beta2')) {
    return;
  }

  let url = new URL(location.href);
  url.search = '?beta1=' + getOption('beta1') + '&beta2=' + getOption('beta2');
  history.replaceState({}, document.title, url.href);

  document.getElementById('frame').src = 'https://crash-analysis.mozilla.com/rkaiser/datil/searchcompare/?common=product%3DFirefox&p1=version%3D' + getOption('beta1') + '&p2=version%3D' + getOption('beta2');
}

onLoad
.then(() => fetch('https://crash-stats.mozilla.com/api/ProductVersions/?product=Firefox&active=true&build_type=beta'))
.then(response => response.json())
.then(data => {
  let betas1 = document.getElementById('beta1');
  let betas2 = document.getElementById('beta2');
  let hits = data['hits'];
  for (let hit of hits.reverse()) {
    let version = hit['version'];
    if (isNaN(version[version.length - 1])) {
      continue;
    }

    var opt = document.createElement('option');
    opt.value = version;
    opt.textContent = version;
    betas1.appendChild(opt);
    betas2.appendChild(opt.cloneNode(true));
  }

  betas1.selectedIndex = betas1.options.length - 2;
  betas2.selectedIndex = betas2.options.length - 1;
})
.then(function() {
  let queryVars = new URL(location.href).search.substring(1).split('&');

  Object.keys(options)
  .forEach(function(optionName) {
    let optionType = getOptionType(optionName);
    let elem = document.getElementById(optionName);

    for (let queryVar of queryVars) {
      if (queryVar.startsWith(optionName + '=')) {
        let option = queryVar.substring((optionName + '=').length).trim();
        setOption(optionName, option);
      }
    }

    if (optionType === 'select') {
      if (getOption(optionName)) {
        elem.checked = getOption(optionName);
      }

      setOption(optionName, elem.checked);
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
      };
    } else if (optionType === 'button') {
      if (getOption(optionName)) {
        elem.value = getOption(optionName);
      }

      setOption(optionName, elem.value.trim());
    } else {
      throw new Error('Unexpected option type.');
    }

    document.getElementById('compareButton').onclick = function() {
      getComparison();
    };
  });

  if (queryVars.length >= 2) {
    getComparison();
  }
})
.catch(function(err) {
  console.error(err);
});
