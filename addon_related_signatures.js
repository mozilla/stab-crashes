let onLoad = new Promise(function(resolve, reject) {
  window.onload = resolve;
});

function addRow(channel, signature, addons) {
  let table = document.getElementById('table');

  let row = table.insertRow(table.rows.length);

  let channel_column = row.insertCell(0);
  channel_column.appendChild(document.createTextNode(channel));

  let signature_column = row.insertCell(1);
  let signature_link = document.createElement('a');
  signature_link.textContent = signature;
  signature_link.href = 'correlations.html?product=Firefox&channel=' + channel + '&signature=' + signature;
  signature_column.appendChild(signature_link);

  let addons_column = row.insertCell(2);
  let addons_pre = document.createElement('pre');

  addons_pre.textContent = addons
  .reduce((prev, cur) => {
    return prev.concat(Object.getOwnPropertyNames(cur['item'])
    .filter(elem => elem.startsWith('Addon'))
    .map(elem => elem.substring(elem.indexOf('"') + 1, elem.lastIndexOf('"'))));
  }, [])
  .filter((addon_name, i, addon_names) => addon_names.indexOf(addon_name) === i)
  .join(', ');

  addons_column.appendChild(addons_pre);
}

function buildTable() {
  fetch('https://analysis-output.telemetry.mozilla.org/top-signatures-correlations/data/addon_related_signatures.json.gz')
  .then(response => response.json())
  .then(addon_related_signatures => {
    for (let channel of ['release', 'beta', 'aurora', 'nightly']) {
      for (let obj of addon_related_signatures[channel]) {
        addRow(channel, obj['signature'], obj['addons'])
      }
    }
  })
  .catch(function(err) {
    console.error(err);
  });
}

onLoad
.then(function() {
  buildTable();
})
.catch(function(err) {
  console.error(err);
});
