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

  while(table.rows.length > 1) {
    table.deleteRow(table.rows.length - 1);
  }

  let url = new URL(location.href);
  url.search = '?beta1=' + getOption('beta1') + '&beta2=' + getOption('beta2');
  history.replaceState({}, document.title, url.href);

  let fromchange = 'FIREFOX_' + getOption('beta1').replace('.', '_') + '_RELEASE';
  let tochange = 'FIREFOX_' + getOption('beta2').replace('.', '_') + '_RELEASE';

  fetch('https://hg.mozilla.org/releases/mozilla-beta/pushloghtml?fromchange=' + fromchange + '&tochange=' + tochange)
  .then(response => response.text())
  .then(data => {
    let bugs = new Set();
    let regex = /Bug ([0-9]+)/gi;
    let res;
    while ((res = regex.exec(data)) !== null) {
      bugs.add(res[1]);
    }

    let table = document.getElementById('table');

    bugs.forEach(bug =>
      fetch('https://bugzilla.mozilla.org/rest/bug/' + bug + '?include_fields=cf_crash_signature')
      .then(response => response.json())
      .then(data => {
        // Skip bugs with no signatures.
        if ('bugs' in data && data['bugs'][0]['cf_crash_signature'] == '') {
          return;
        }

        let row = table.insertRow(table.rows.length);
        let bugElem = row.insertCell(0);
        let aElem = document.createElement('a');
        aElem.href = 'https://bugzilla.mozilla.org/show_bug.cgi?id=' + bug;
        aElem.textContent = bug;
        bugElem.appendChild(aElem);

        let evolution = row.insertCell(1);

        let result = document.createElement('span');

        if (!('bugs' in data)) {
          result.style.color = 'maroon';
          result.textContent = 'Not accessible.';
        } else {
          let signatures = data['bugs'][0]['cf_crash_signature'];
          signatures = signatures.replace(/\[@ /g, '[@');
          signatures = signatures.replace(/\[@/g, '');
          signatures = signatures.replace(/ ]\r\n/g, '\\');
          signatures = signatures.replace(/]\r\n/g, '\\');
          signatures = signatures.replace(']', '');

          signatures = signatures.split('\\');

          let query1 = fetch('https://crash-stats.mozilla.com/api/SuperSearch/?product=Firefox&_results_number=0&_facets_size=0&version=' + getOption('beta1') + '&signature=%3D' + signatures.join('&signature=%3D'))
          .then(response => response.json());
          let query2 = fetch('https://crash-stats.mozilla.com/api/SuperSearch/?product=Firefox&_results_number=0&_facets_size=0&version=' + getOption('beta2') + '&signature=%3D' + signatures.join('&signature=%3D'))
          .then(response => response.json());

          Promise.all([ query1, query2 ])
          .then(data => {
            result.textContent = data[0]['total'] + ' before; ' + data[1]['total'] + ' after.';
          });
        }

        evolution.appendChild(result);
      })
    );
  });
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
