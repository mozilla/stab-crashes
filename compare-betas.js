let options = {
  'beta1': {
    value: null,
    type: 'option',
  },
  'beta2': {
    value: null,
    type: 'option',
  },
  'product': {
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

function getReleaseDate(version, build_id, release_history) {
  if (build_id) {
    // XXX: Assume release date is the build ID. Remove this
    // hack when https://bugzilla.mozilla.org/show_bug.cgi?id=1192197 is fixed.
    return new Date(build_id.substring(0, 4) + '-' + build_id.substring(4, 6) + '-' + build_id.substring(6, 8))
  }

  return new Date(release_history[version]);
}

function getComparison() {
  if (!getOption('beta1') || !getOption('beta2')) {
    return;
  }

  let version1 = getOption('beta1');
  let version2 = getOption('beta2');
  let build_id1 = '';
  let build_id2 = '';
  if (version1.includes(' - ')) {
    let vals = version1.split(' - ');
    version1 = vals[0];
    build_id1 = vals[1];
  }
  if (version2.includes(' - ')) {
    let vals = version2.split(' - ');
    version2 = vals[0];
    build_id2 = vals[1];
  }

  fetch('https://product-details.mozilla.org/1.0/firefox_history_development_releases.json')
  .then(response => response.json())
  .then(release_history => {
    let date1 = getReleaseDate(version1, build_id1, release_history);
    let date2 = getReleaseDate(version2, build_id2, release_history);

    let url = new URL(location.href);
    url.search = '?product=' + getOption('product') + '&beta1=' + getOption('beta1') + '&beta2=' + getOption('beta2');
    history.replaceState({}, document.title, url.href);

    document.getElementById('frame').src = 'scomp.html?common=product%3D' + getOption('product') + '&p1=version%3D' + version1 + ((build_id1) ? '%26build_id=' + build_id1 : '') + '&p2=version%3D' + version2 + ((build_id2) ? '%26build_id=' + build_id2 : '');

    let total1, total2;
    Promise.all([
      fetch('https://crash-stats.mozilla.com/api/SuperSearch/?product=' + getOption('product') + '&version=' + version1 + ((build_id1) ? '&build_id=' + build_id1 : '') + '&_results_number=0&_facets_size=0' + '&date=>%3D' + dateToStr(date1))
      .then(response => response.json())
      .then(results => total1 = results['total'] || 0),
      fetch('https://crash-stats.mozilla.com/api/SuperSearch/?product=' + getOption('product') + '&version=' + version2 + ((build_id2) ? '&build_id=' + build_id2 : '') + '&_results_number=0&_facets_size=0' + '&date=>%3D' + dateToStr(date2))
      .then(response => response.json())
      .then(results => total2 = results['total'] || 0),
    ])
    .then(() => {
      let warning = '';
      if (total1 < total2 * 0.2) {
        warning = 'WARNING: Number of crash reports for ' + getOption('beta1') + ' (' + total1 + ') are way lower than for ' + getOption('beta2') + ' (' + total2 +'); the comparison might be skewed.';
      } else if (total2 < total1 * 0.2) {
        warning = 'WARNING: Number of crash reports for ' + getOption('beta2') + ' (' + total2 + ') are way lower than for ' + getOption('beta1') + ' (' + total1 +'); the comparison might be skewed.';
      }
      document.getElementById('warning').textContent = warning;
    });
  });
}

function compareBuildIDs(build_id1, build_id2) {
  let year1 = Number(build_id1.substring(0, 4));
  let year2 = Number(build_id2.substring(0, 4));
  if (year1 > year2) {
    return 1;
  } else if (year1 < year2) {
    return -1;
  }

  let month1 = Number(build_id1.substring(4, 6));
  let month2 = Number(build_id2.substring(4, 6));
  if (month1 > month2) {
    return 1;
  } else if (month1 < month2) {
    return -1;
  }

  let day1 = Number(build_id1.substring(6, 8));
  let day2 = Number(build_id2.substring(6, 8));
  if (day1 > day2) {
    return 1;
  } else if (day1 < day2) {
    return -1;
  }

  return 0;
}

function compareVersions(versionA, versionB) {
  let majorA = Number(versionA.substring(0, versionA.indexOf('.')));
  let majorB = Number(versionB.substring(0, versionB.indexOf('.')));

  if (majorA > majorB) {
    return 1
  } else if (majorA < majorB) {
    return -1;
  }

  let minorA;
  let minorB;
  if (!versionA.includes(' - ')) {
    minorA = Number(versionA.substring(versionA.indexOf('b') + 1))
  } else {
    minorA = Number(versionA.substring(versionA.indexOf('b') + 1), versionA.indexOf(' '));
  }
  if (!versionB.includes(' - ')) {
    minorB = Number(versionB.substring(versionB.indexOf('b') + 1))
  } else {
    minorB = Number(versionB.substring(versionB.indexOf('b') + 1), versionB.indexOf(' '));
  }

  if (minorA > minorB) {
    return 1;
  } else if (minorA < minorB) {
    return -1;
  }

  let buildIDA = versionA.substring(versionA.indexOf(' - ') + 3);
  let buildIDB = versionB.substring(versionB.indexOf(' - ') + 3);

  return compareBuildIDs(buildIDA, buildIDB);
}

onLoad
.then(() => fetch('https://crash-stats.mozilla.com/api/ProductVersions/?product=Firefox&build_type=beta'))
.then(response => response.json())
.then(data => {
  let versions = data['hits'].map(hit => hit['version']).filter(version => !isNaN(version[version.length - 1]));

  let rc = versions.find(version => version.endsWith('b99'));
  if (rc) {
    return fetch('https://crash-stats.mozilla.com/api/SuperSearch/?version=' + rc + '&product=Firefox&_facets=build_id&_results_number=0')
    .then(response => response.json())
    .then(data => {
      return data['facets']['build_id'].map(elem => rc + ' - ' + elem['term'])
      .concat(versions);
    });
  } else {
    return versions;
  }
})
.then(versions => {
  return versions.sort(compareVersions);
})
.then(versions => {
  // Only consider the latest 10 builds.
  if (versions.length > 10) {
    versions = versions.slice(versions.length - 10);
  }

  return versions;
})
.then(versions => {
  let betas1 = document.getElementById('beta1');
  let betas2 = document.getElementById('beta2');

  for (let i = 0; i < versions.length; i++) {
    let version = versions[i];

    var opt = document.createElement('option');
    opt.value = opt.textContent = version;

    if (i != versions.length - 1) {
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
          if (elem.options[i].value === decodeURIComponent(getOption(optionName))) {
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
