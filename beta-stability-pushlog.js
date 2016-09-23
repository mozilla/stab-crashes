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

function dateToStr(date) {
  let month = '' + (date.getMonth() + 1);
  let day = '' + date.getDate();
  let year = date.getFullYear();

  if (month.length < 2) {
    month = '0' + month;
  }

  if (day.length < 2) {
    day = '0' + day;
  }

  return year + '-' + month + '-' + day;
}

function addDays(date, days) {
  let result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getBaseVersion(version) {
  return version.substring(0, version.indexOf('.0b'));
}

function getReleaseDate(version, release_history) {
  if (version.endsWith('b99') && !(version in release_history)) {
    // XXX: Assume release date is really close to latest beta build. Remove this
    // hack when https://bugzilla.mozilla.org/show_bug.cgi?id=1192197 is fixed.
    let maxDate = new Date(0);
    for (let release of Object.entries(release_history).filter(r => r[0].startsWith(getBaseVersion(version)))) {
      let date = new Date(release[1]);
      if (date > maxDate) {
        maxDate = date;
      }
    }

    return maxDate;
  }

  return new Date(release_history[version]);
}

function getTag(version) {
  if (version.endsWith('b99')) {
    return 'FIREFOX_RELEASE_' + getBaseVersion(version) + '_BASE';
  }

  return 'FIREFOX_' + version.replace('.', '_') + '_RELEASE';
}

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

  fetch('https://product-details.mozilla.org/1.0/firefox_history_development_releases.json')
  .then(response => response.json())
  .then(release_history => {
    let date1 = getReleaseDate(getOption('beta1'), release_history);
    let date2 = getReleaseDate(getOption('beta2'), release_history);
    let endDate1 = addDays(date1, 7);
    let endDate2 = addDays(date2, 7);

    document.getElementById('dates').innerHTML = getOption('beta1') + ' released on ' + dateToStr(date1) + ' (crashes from ' + dateToStr(date1) + ' to ' + dateToStr(endDate1) + ')<br>' + getOption('beta2') + ' released on ' + dateToStr(date2) + ' (crashes from ' + dateToStr(date2) + ' to ' + dateToStr(endDate2) + ')';

    let fromchange = getTag(getOption('beta1'));
    let tochange = getTag(getOption('beta2'));

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

            let query1 = fetch('https://crash-stats.mozilla.com/api/SuperSearch/?product=Firefox&_results_number=0&_facets_size=0&version=' + getOption('beta1') + '&date=>%3D' + dateToStr(date1) + '&date=<%3D' + dateToStr(date2) + '&signature=%3D' + signatures.join('&signature=%3D'))
            .then(response => response.json());
            let query2 = fetch('https://crash-stats.mozilla.com/api/SuperSearch/?product=Firefox&_results_number=0&_facets_size=0&version=' + getOption('beta2') + '&date=>%3D' + dateToStr(date1) + '&date=<%3D' + dateToStr(date2) + '&signature=%3D' + signatures.join('&signature=%3D'))
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
  });
}

let curBeta;

onLoad
.then(() => fetch('https://product-details.mozilla.org/1.0/firefox_versions.json'))
.then(response => response.json())
.then(result => {
  let betaVersion = result['LATEST_FIREFOX_DEVEL_VERSION'];
  curBeta = betaVersion.substring(0, betaVersion.indexOf('.'));
})
.then(() => fetch('https://crash-stats.mozilla.com/api/ProductVersions/?product=Firefox&active=true&build_type=beta'))
.then(response => response.json())
.then(data => {
  let betas1 = document.getElementById('beta1');
  let betas2 = document.getElementById('beta2');

  let hits = data['hits']
  .filter(hit => !isNaN(hit['version'][hit['version'].length - 1]))
  .filter(hit => hit['version'].startsWith(curBeta))
  .reverse();

  if (hits.length <= 1) {
    let warning = 'Need at least two beta builds in order to compare.';
    if (hits.length == 1) {
      warning += ' Currently only ' + hits[0]['version'] + ' is available.'
    }
    document.getElementById('dates').innerHTML = '<p style="font-weight: bold; color: red;">' + warning + '</p>';
    throw new Error('Need at least two beta builds in order to compare.');
  }

  for (let i = 0; i < hits.length; i++) {
    let version = hits[i]['version'];

    var opt = document.createElement('option');
    opt.value = version;
    opt.textContent = version;

    if (i != hits.length - 1) {
      betas1.appendChild(opt);
    }

    if (i != 0) {
      betas2.appendChild(opt.cloneNode(true));
    }
  }

  betas1.selectedIndex = betas1.options.length - 1;
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
