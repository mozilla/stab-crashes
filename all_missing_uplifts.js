let crashesFile, crashes;
let options = {
  'channel': {
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

function fetchWithRetry(url, trials=0) {
  return fetch(url)
  .then(response => {
    if (!response.ok) {
      throw new Error('Error while getting ' + url);
    } else {
      return response;
    }
  })
  .catch(error => {
    let timeout = Math.pow(2, trials) * 1000;

    if (timeout > 32000) {
      timeout = 32000;
    }

    if (trials > 64) {
      throw error;
    }

    return new Promise(function(resolve, reject) {
      setTimeout(() => {
        fetchWithRetry(url, trials + 1).then(resolve, reject);
      }, timeout);
    });
  });
}

function getFeaturedVersion() {
  return fetchWithRetry('https://crash-stats.mozilla.com/api/ProductVersions/?product=Firefox&build_type=' + getOption('channel') + '&is_featured=true')
  .then(response => response.json())
  .then(data => data['hits'][0]['version']);
}

function getVersion(channel) {
  return fetchWithRetry('https://product-details.mozilla.org/1.0/firefox_versions.json')
  .then(response => response.json())
  .then(data => {
    if (channel == 'aurora') {
      return data['FIREFOX_AURORA'];
    }

    if (channel == 'beta') {
      return data['LATEST_FIREFOX_DEVEL_VERSION'];
    }

    if (channel == 'release') {
      return data['LATEST_FIREFOX_VERSION'];
    }
  })
  .then(full_version => Number(full_version.substring(0, full_version.indexOf('.'))))
}

function getFixedIn(bug, version) {
  let statuses = ['', '---', '?', 'fix-optional', 'affected'];
  if (getOption('wontfix')) {
    statuses.push('wontfix');
  }

  if (!statuses.includes(bug['cf_status_firefox' + version])) {
    return [];
  }

  let versionEnd = version;
  if (getOption('channel') == 'aurora') {
    versionEnd += 1;
  } else if (getOption('channel') == 'beta') {
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

function addRow(bug, version) {
  let table = document.getElementById('table');

  let row = table.insertRow(table.rows.length);

  let today = new Date();
  let three_days_ago = new Date().setDate(today.getDate() - 3);
  let ten_days_ago = new Date().setDate(today.getDate() - 10);
  let bug_elem = row.insertCell(0);

  let fixedIn = getFixedIn(bug, version);

  let bugLink = document.createElement('a');
  bugLink.appendChild(document.createTextNode(bug.id + ' - ' + 'Fixed in ' + fixedIn.join(', ') + ', \'' + bug['cf_status_firefox' + version] + '\' in ' + version + '.'));
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

  bug_elem.appendChild(bugLink);

  let signatures_elem = row.insertCell(1);
  bug['signatures'].forEach(signature => {
    let signature_link = document.createElement('a');
    signature_link.appendChild(document.createTextNode(signature));
    signature_link.href = 'https://crash-stats.mozilla.com/signature/?signature=' + encodeURIComponent(signature);
    signatures_elem.appendChild(signature_link);
    signatures_elem.appendChild(document.createElement('br'));
  });


  let crashes_count = row.insertCell(2);
  crashes_count.appendChild(document.createTextNode(bug['crashes_count']));
}

function buildTable() {
  return getVersion(getOption('channel'))
  .then(version => {
    let versionEnd = version;
    if (getOption('channel') == 'aurora') {
      versionEnd += 1;
    } else if (getOption('channel') == 'beta') {
      versionEnd += 2;
    } else if (getOption('channel') == 'release') {
      versionEnd += 3;
    }

    let query = 'https://bugzilla.mozilla.org/rest/bug?f1=cf_crash_signature&o1=isnotempty&';
    let fieldNum = 2;

    query += 'j' + fieldNum + '=AND&f' + fieldNum + '=OP&';
    fieldNum++;

    query += 'f' + fieldNum + '=cf_status_firefox' + version + '&o' + fieldNum + '=notequals&v' + fieldNum + '=fixed&';
    fieldNum++;
    query += 'f' + fieldNum + '=cf_status_firefox' + version + '&o' + fieldNum + '=notequals&v' + fieldNum + '=verified&';
    fieldNum++;
    query += 'f' + fieldNum + '=cf_status_firefox' + version + '&o' + fieldNum + '=notequals&v' + fieldNum + '=unaffected&';
    fieldNum++;
    if (!getOption('wontfix')) {
      query += 'f' + fieldNum + '=cf_status_firefox' + version + '&o' + fieldNum + '=notequals&v' + fieldNum + '=wontfix&';
      fieldNum++;
    }

    query += 'f' + fieldNum + '=CP&';
    fieldNum++;

    query += 'j' + fieldNum + '=OR&f' + fieldNum + '=OP&';
    fieldNum++;

    for (v = version + 1; v <= versionEnd; v++) {
        query += 'j' + fieldNum + '=OR&f' + fieldNum + '=OP&';
        fieldNum++;
        query += 'f' + fieldNum + '=cf_status_firefox' + v + '&o' + fieldNum + '=equals&v' + fieldNum + '=verified&';
        fieldNum++;
        query += 'f' + fieldNum + '=cf_status_firefox' + v + '&o' + fieldNum + '=equals&v' + fieldNum + '=fixed&';
        fieldNum++;
        query += 'f' + fieldNum + '=CP&';
        fieldNum++;
    }
    query += 'f' + fieldNum + '=CP&';
    fieldNum++;

    query += 'include_fields=id,last_change_time,cf_crash_signature';
    for (v = version; v <= versionEnd; v++) {
        query += ',cf_status_firefox' + v;
    }

    return getFeaturedVersion()
    .then(featured_version => {
      return fetchWithRetry(query)
      .then(response => response.json())
      .then(data => data['bugs'])
      .then(bugs => Promise.all(bugs.map(bug => {
        let signatures = bug['cf_crash_signature'].split(/\s*]\s*/).map(signature => signature.substring(2).trim());

        let count = 0;

        return Promise.all(
          signatures.map(signature =>
            fetchWithRetry('https://crash-stats.mozilla.com/api/SuperSearch/?version=' + featured_version + '&signature=%3D' + encodeURIComponent(signature) + '&product=Firefox&_results_number=0&_facets_size=0')
            .then(response => response.json())
            .then(result => {
              count += result['total'];
            })
          )
        )
        .then(() => {
          bug['signatures'] = signatures;
          bug['crashes_count'] = count;
          return bug;
        });
      })))
      .then(bugs => bugs.filter(bug => bug['crashes_count'] > 0))
      .then(bugs => bugs.sort((a, b) => b['crashes_count'] - a['crashes_count']))
      .then(bugs => bugs.forEach(bug => addRow(bug, version)));
    });
  });
}

function startSpinner() {
  document.getElementById('spin').style.display = '';
  document.getElementById('table').style.display = 'none';
}

function stopSpinner() {
  document.getElementById('spin').style.display = 'none';
  document.getElementById('table').style.display = '';
}

function reloadPage() {
  let url = new URL(location.href);
  url.search = '?channel=' + getOption('channel');
  window.location = url;
}

onLoad
.then(() => startSpinner())
.then(() => {
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
        reloadPage();
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
        reloadPage();
      };
    } else if (optionType === 'button') {
      if (getOption(optionName)) {
        elem.value = getOption(optionName);
      }

      setOption(optionName, elem.value);

      document.getElementById(optionName + 'Button').onclick = function() {
        setOption(optionName, elem.value);
        reloadPage();
      };
    } else {
      throw new Error('Unexpected option type.');
    }
  });
})
.then(() => buildTable())
.then(() => stopSpinner())
.catch(err => console.error(err));
