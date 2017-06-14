let crashesFile, crashes;
let options = {
  'channel': {
    value: null,
    type: 'option',
  },
  'crashesType': {
    value: null,
    type: 'option',
  },
  'wontfix': {
    value: null,
    type: 'select',
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

function agoString(val, str) {
  return val + ' ' + (val == 1 ? str : str + 's') + ' ago';
}

function prettyDate(date) {
  date = new Date(date);
  let today = new Date();

  let hoursDiff = Math.round((today.getTime() - date.getTime()) / 3600000);
  if (hoursDiff < 24) {
    return agoString(hoursDiff, 'hour');
  }

  let daysDiff = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (daysDiff < 10) {
    return agoString(daysDiff, 'day');
  }

  let weeksDiff = Math.round((today.getTime() - date.getTime()) / (7 * 86400000));
  if (weeksDiff < 3) {
    return agoString(weeksDiff, 'week');
  }

  let monthsDiff = (today.getMonth() + 12 * today.getFullYear()) - (date.getMonth() + 12 * date.getFullYear());
  if (monthsDiff < 12) {
    return agoString(monthsDiff, 'month');
  }

  return agoString(today.getFullYear() - date.getFullYear(), 'year');
}

function getVersion() {
  return Number(crashes.versions[0].substring(0, crashes.versions[0].indexOf('.')));
}

function getFixedIn(bug) {
  let version = getVersion();

  let statuses = ['', '---', '?', 'fix-optional', 'affected'];
  if (getOption('wontfix')) {
    statuses.push('wontfix');
  }

  if (!statuses.includes(bug['cf_status_firefox' + version])) {
    return [];
  }

  let versionEnd = version;
  if (getOption('channel') == 'beta') {
    versionEnd += 2;
  } else if (getOption('channel') == 'release') {
    versionEnd += 3;
  }

  let fixedIn = [];
  for (version += 1; version <= versionEnd; version++) {
    if (bug['cf_status_firefox' + version] === 'fixed' ||
        bug['cf_status_firefox' + version] === 'verified') {
      fixedIn.push(version);
    }
  }

  return fixedIn;
}

function addRow(signature, obj) {
  let table = document.getElementById('table');

  let row = table.insertRow(table.rows.length);

  let rank = row.insertCell(0);
  rank.appendChild(document.createTextNode(obj.tc_rank));

  let key = row.insertCell(1);

  let startupImage = document.createElement('img');
  startupImage.title = (obj.startup_percent * 100).toFixed(2) + ' %';
  startupImage.src = 'rocket_fly.png';
  startupImage.width = 64 * obj.startup_percent;
  startupImage.height = 64 * obj.startup_percent;
  startupImage.style.paddingRight = 5;
  key.appendChild(startupImage);

  let signatureDiv = document.createElement('div');
  signatureDiv.className = 'tooltip';

  let signatureLink = document.createElement('a');
  signatureLink.appendChild(document.createTextNode(signature));
  signatureLink.href = 'https://crash-stats.mozilla.com/signature/?date=<%3D' + crashes.end_date + '&date=>%3D' + crashes.start_date + '&product=Firefox&' + crashes.versions.map(version => 'version=' + version).join('&') + '&signature=' + signature;
  signatureDiv.appendChild(signatureLink);

  key.appendChild(signatureDiv);

  let today = new Date();
  let three_days_ago = new Date().setDate(today.getDate() - 3);
  let ten_days_ago = new Date().setDate(today.getDate() - 10);
  let bugs = row.insertCell(2);
  obj.bugs
  .sort((bug1, bug2) => new Date(bug2.last_change_time) - new Date(bug1.last_change_time))
  .forEach(function(bug) {
    let fixedIn = getFixedIn(bug);
    if (fixedIn.length == 0) {
      return;
    }

    let bugLink = document.createElement('a');
    bugLink.appendChild(document.createTextNode(bug.id + ' - ' + 'Fixed in ' + fixedIn.join(', ') + ', \'' + bug['cf_status_firefox' + getVersion()] + '\' in ' + getVersion() + '.'));
    bugLink.title = (bug.resolution ? bug.resolution + ' - ' : '') +
                    'Last activity: ' + prettyDate(bug.last_change_time);
    bugLink.href = 'https://bugzilla.mozilla.org/show_bug.cgi?id=' + bug.id;

    let bugDate = new Date(bug.last_change_time);
    if (bugDate > three_days_ago) {
      bugLink.style.color = 'green';
    } else if (bugDate > ten_days_ago) {
      bugLink.style.color = 'orange';
    } else {
      bugLink.style.color = 'red';
    }

    bugs.appendChild(bugLink);
    bugs.appendChild(document.createElement('br'));
  });
}

function buildTable() {
  let file = getOption('channel');
  if (getOption('crashesType') === 'All crashes') {
    file += '.json';
  } else if (getOption('crashesType') === 'Startup crashes') {
    file += '-startup.json'
  }

  let promise;
  if (file === crashesFile) {
    promise = Promise.resolve();
  } else {
    promise = fetch(file)
    .then(function(response) {
      return response.json();
    })
    .then(function(val) {
      crashes = val;
    });

    crashesFile = file;
  }

  promise
  .then(function() {
    // Order signatures by rank change or kairo's explosiveness.
    Object.keys(crashes.signatures)
    .sort((signature1, signature2) => crashes.signatures[signature1].tc_rank - crashes.signatures[signature2].tc_rank)
    .filter(signature => crashes.signatures[signature].bugs.filter(bug => getFixedIn(bug).length > 0).length > 0)
    .forEach(function(signature) {
      addRow(signature, crashes.signatures[signature]);
    });
  })
  .catch(function(err) {
    console.error(err);
  });
}

function rebuildTable() {
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

    if (optionType === 'select') {
      setOption(optionName, elem.checked);

      elem.onchange = function() {
        setOption(optionName, elem.checked);
        rebuildTable();
      };
    } else if (optionType === 'option') {
      setOption(optionName, elem.options[elem.selectedIndex].value);

      elem.onchange = function() {
        setOption(optionName, elem.options[elem.selectedIndex].value);
        rebuildTable();
      };
    } else if (optionType === 'button') {
      setOption(optionName, elem.value);

      document.getElementById(optionName + 'Button').onclick = function() {
        setOption(optionName, elem.value);
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
