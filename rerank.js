let options = {
  'product': {
    value: null,
    type: 'option',
  },
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
  url.search = '?product=' + getOption('product') + '&channel=' + getOption('channel') + '&signature=' + getOption('signature');
  history.replaceState({}, document.title, url.href);

  let signature = decodeURIComponent(getOption('signature'));
  let channel = getOption('channel');
  let product = getOption('product');

  document.getElementById('channel_from').textContent = channel;

  let table = document.getElementById('rerank_table');
  while (table.rows.length > 1) {
    table.deleteRow(table.rows.length - 1);
  }

  let preElem = document.getElementById('rerank_text');
  correlations.rerank(preElem, signature, channel, 'release', product)
  .then(entries => entries.forEach(entry => {
    let row = table.insertRow(table.rows.length);

    let property = row.insertCell(0);
    property.appendChild(document.createTextNode(entry.property));

    let in_signature = row.insertCell(1);
    in_signature.appendChild(document.createTextNode(entry.in_signature + ' %'));

    let in_channel = row.insertCell(2);
    in_channel.appendChild(document.createTextNode(correlations.toPercentage(entry.in_channel) + ' %'));

    let in_channel_target = row.insertCell(3);
    in_channel_target.appendChild(document.createTextNode(correlations.toPercentage(entry.in_channel_target) + ' %'));

    let channel_multiplier = entry.in_channel_target / entry.in_channel;
    let channel_multiplier_cell = row.insertCell(4);

    let channel_multiplier_span = document.createElement('span');
    channel_multiplier_span.textContent = channel_multiplier.toFixed(2) + 'x';
    if (channel_multiplier < 1) {
      channel_multiplier_span.style.color = 'green';
    } else {
      channel_multiplier_span.style.color = 'red';
    }

    channel_multiplier_cell.appendChild(channel_multiplier_span);
  }));
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
        let option = queryVar.substring((optionName + '=').length).trim();
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

      setOption(optionName, elem.value.trim());

      document.getElementById(optionName + 'Button').onclick = function() {
        setOption(optionName, elem.value.trim());
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
