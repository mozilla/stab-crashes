let options = {
  'channel': {
    value: null,
    type: 'option',
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

function getAddons(obj) {
  return obj['addons']
  .reduce((prev, cur) => {
    return prev.concat(
      Object.getOwnPropertyNames(cur['item'])
      .filter(elem => elem.startsWith('Addon'))
      .map(elem => {
        return {
          'name': elem.substring(elem.indexOf('"') + 1, elem.lastIndexOf('"')),
          'support': cur['count_group'] / obj['total'],
        };
      })
    );
  }, [])
  .filter((addon, i, addons) => addons.indexOf(addon) === i);
}

function addRow(obj) {
  let table = document.getElementById('table');

  let row = table.insertRow(table.rows.length);

  let signature_column = row.insertCell(0);
  let signature_link = document.createElement('a');
  signature_link.textContent = obj['signature'];
  signature_link.href = 'https://crash-stats.mozilla.org/signature/?signature=' + obj['signature'] + '&release_channel=' + getOption('channel') + '#correlations';
  signature_column.appendChild(signature_link);

  let addons_column = row.insertCell(1);
  let addons_pre = document.createElement('pre');

  addons_pre.textContent = getAddons(obj)
  .map(elem => elem['name'] + ' (' + (elem['support'] * 100).toFixed(2) + '%)')
  .join(', ');

  addons_column.appendChild(addons_pre);
}

function buildTable() {
  fetch('https://analysis-output.telemetry.mozilla.org/top-signatures-correlations/data/addon_related_signatures.json.gz')
  .then(response => response.json())
  .then(addon_related_signatures => {
    addon_related_signatures[getOption('channel')]
    .sort((obj1, obj2) => Math.max(...getAddons(obj2).map(elem => elem['support'])) - Math.max(...getAddons(obj1).map(elem => elem['support'])))
    .forEach(obj => addRow(obj));
  })
  .catch(function(err) {
    console.error(err);
  });
}

function rebuildTable() {
  let table = document.getElementById('table');

  while(table.rows.length > 1) {
    table.deleteRow(table.rows.length - 1);
  }

  buildTable();
}

onLoad
.then(function() {
  Object.keys(options)
  .forEach(function(optionName) {
    let optionType = getOptionType(optionName);
    let elem = document.getElementById(optionName);

    if (optionType === 'option') {
      setOption(optionName, elem.options[elem.selectedIndex].value);

      elem.onchange = function() {
        setOption(optionName, elem.options[elem.selectedIndex].value);
        rebuildTable();
      };
    } else {
      throw new Error('Unexpected option type.');
    }
  });
})
.then(function() {
  buildTable();
})
.catch(function(err) {
  console.error(err);
});
