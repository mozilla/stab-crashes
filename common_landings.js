let onLoad = new Promise(function(resolve, reject) {
  window.onload = resolve;
});

function dropdownDateToDaysDiff(val) {
  if (val === 'one day') {
    return 1;
  } else if (val === 'two days') {
    return 2;
  } else if (val === 'three days') {
    return 3;
  } else if (val === 'a week') {
    return 7;
  }

  throw new Exception('Unknown value ' + val);
}

function dropdownBuildToVal(val) {
  if (val === 'one build') {
    return 1;
  } else if (val === 'two builds') {
    return 2;
  } else if (val === 'three builds') {
    return 3;
  }

  throw new Exception('Unknown value ' + val);
}

function betaBuildToTag(val) {
  return 'FIREFOX_' + val.replace('.', '_') + '_RELEASE';
}

function subtractFromBetaBuild(version, val) {
  let major = version.substring(0, version.indexOf('b'));
  let betaBuild = version.substring(version.indexOf('b') + 1);
  return major + 'b' + (Number(betaBuild) - val);
}

function checkIsBuildID(val) {
  let isBuildID = true;

  try {
    let res = parseBuildID(val);
    if (isNaN(res.year) || isNaN(res.month) || isNaN(res.day) || isNaN(res.hour) || isNaN(res.minute) || isNaN(res.second) || res.year < 2000 || res.month < 0 || res.month > 12 || res.day < 0 || res.day > 31 || res.hour < 0 || res.hour > 24) {
      isBuildID = false;
    }
  } catch (ex) {
    isBuildID = false;
  }

  return isBuildID;
}

function getPushlogLink(channel) {
  let base;
  if (channel === 'nightly') {
    base = 'https://hg.mozilla.org/mozilla-central';
  } else if (channel === 'aurora') {
    base = 'https://hg.mozilla.org/releases/mozilla-aurora';
  }

  let firstAffected = document.getElementById(channel + '_first_affected').value;
  if (firstAffected) {
    let isBuildID = checkIsBuildID(firstAffected);

    let startDateElem = document.getElementById(channel + '_days');
    let startDate = dropdownDateToDaysDiff(startDateElem.options[startDateElem.selectedIndex].value);
    let pushlogLinkElem = document.getElementById(channel + '_pushloglink');

    return (new Promise(function(resolve, reject) {
      if (!isBuildID) {
        resolve(firstAffected);
      } else {
        fromBuildIDtoChangeset(firstAffected, channel)
        .then(changesetURL => resolve(getRevFromChangeset(changesetURL, channel)));
      }
    }))
    .then(changeset =>
      getChangesetDate(changeset, channel)
      .then(date => {
        date.setDate(date.getDate() - startDate);
        let year = date.getFullYear();
        let month = toTwoDigits(date.getMonth() + 1);
        let day = toTwoDigits(date.getDate());
        let pushlogLink = base + '/pushloghtml?startdate=' + year + '-' + month + '-' + day + '&tochange=' + changeset;
        pushlogLinkElem.textContent = pushlogLinkElem.href = pushlogLink;
        return pushlogLink;
      })
    );
  }

  return null;
}

function getCommonLandings() {
  let pushlog_link_promises = [];

  // Nightly
  let nightlyPushlogLink = getPushlogLink('nightly');
  if (nightlyPushlogLink) {
    pushlog_link_promises.push(nightlyPushlogLink);
  }

  // Aurora
  let auroraFirstAffected = getPushlogLink('aurora');
  if (auroraFirstAffected) {
    pushlog_link_promises.push(auroraFirstAffected);
  }

  // Beta
  let betaFirstAffected = document.getElementById('beta_first_affected').value;
  if (betaFirstAffected) {
    let betaStartBuildElem = document.getElementById('beta_builds');
    let betaStartBuild = subtractFromBetaBuild(betaFirstAffected, dropdownBuildToVal(betaStartBuildElem.options[betaStartBuildElem.selectedIndex].value));
    let betaPushlogLink = 'https://hg.mozilla.org/releases/mozilla-beta/pushloghtml?fromchange=' + betaBuildToTag(betaStartBuild) + '&tochange=' + betaBuildToTag(betaFirstAffected);

    let betaPushlogLinkElem = document.getElementById('beta_pushloglink');
    betaPushlogLinkElem.textContent = betaPushlogLinkElem.href = betaPushlogLink;
    pushlog_link_promises.push(Promise.resolve(betaPushlogLink));
  }

  return Promise.all(
    pushlog_link_promises
    .map(link_promise =>
      link_promise
      .then(link =>
        fetch(link)
        .then(response => response.text())
        .then(html => {
          let bugs = [];

          let result;
          let re = /Bug ([0-9]+)/ig;
          while ((result = re.exec(html)) !== null) {
            bugs.push(result[1]);
          }

          return bugs;
        })
      )
    )
  )
  .then(arrays => {
    if (arrays.length === 0) {
      return [];
    }

    return arrays[0]
    .filter(elem => {
      let is_everywhere = true;

      for (let array of arrays.slice(1)) {
        is_everywhere &= array.includes(elem);
      }

      return is_everywhere;
    })
  })
  .then(bugs => new Set(bugs));
}

onLoad
.then(function() {
  document.getElementById('getCommonLandings').onclick = function() {
    // Clean old results.
    let results = document.getElementById('results');

    while (results.firstChild) {
      results.removeChild(results.firstChild);
    }

    results.textContent = '';

    getCommonLandings()
    .then(bugs => {
      if (bugs.size === 0) {
        results.textContent = 'None';
        return;
      }

      let ul = document.createElement('ul');
      for (let bug of bugs) {
        fetch('https://bugzilla.mozilla.org/rest/bug/' + bug + '?include_fields=summary')
        .then(response => response.json())
        .then(bugData => {
          let li = document.createElement('li');
          let a = document.createElement('a');
          a.textContent = bug + ' - ' + (('bugs' in bugData) ? bugData['bugs'][0]['summary'] : 'Inaccessible');
          a.href = 'https://bugzilla.mozilla.org/show_bug.cgi?id=' + bug;
          li.appendChild(a);
          ul.appendChild(li);
        });
      }

      results.appendChild(ul);
    });
  };
});

