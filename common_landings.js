let onLoad = new Promise(function(resolve, reject) {
  window.onload = resolve;
});

function dropdownDateToHGMODate(val) {
  if (val === 'one day') {
    return '1+day+ago';
  } else if (val === 'two days') {
    return '2+days+ago';
  } else if (val === 'three days') {
    return '3+days+ago';
  } else if (val === 'a week') {
    return '1+week+ago';
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

function getCommonLandings() {
  let pushlog_links = [];


  // Nightly
  let nightlyFirstAffected = document.getElementById('nightly_first_affected').value;
  if (nightlyFirstAffected) {
    let nightlyStartDateElem = document.getElementById('nightly_days');
    let nightlyStartDate = dropdownDateToHGMODate(nightlyStartDateElem.options[nightlyStartDateElem.selectedIndex].value);
    let nightlyPushlogLink = 'https://hg.mozilla.org/mozilla-central/pushloghtml?startdate=' + nightlyStartDate + '&tochange=' + nightlyFirstAffected;

    let nightlyPushlogLinkElem = document.getElementById('nightly_pushloglink');
    nightlyPushlogLinkElem.textContent = nightlyPushlogLinkElem.href = nightlyPushlogLink;
    pushlog_links.push(nightlyPushlogLink);
  }


  // Aurora
  let auroraFirstAffected = document.getElementById('aurora_first_affected').value;
  if (auroraFirstAffected) {
    let auroraStartDateElem = document.getElementById('aurora_days');
    let auroraStartDate = dropdownDateToHGMODate(auroraStartDateElem.options[auroraStartDateElem.selectedIndex].value);
    let auroraPushlogLink = 'https://hg.mozilla.org/releases/mozilla-aurora/pushloghtml?startdate=' + auroraStartDate + '&tochange=' + auroraFirstAffected;

    let auroraPushlogLinkElem = document.getElementById('aurora_pushloglink');
    auroraPushlogLinkElem.textContent = auroraPushlogLinkElem.href = auroraPushlogLink;
    pushlog_links.push(auroraPushlogLink);
  }


  // Beta
  let betaFirstAffected = document.getElementById('beta_first_affected').value;
  if (betaFirstAffected) {
    let betaStartBuildElem = document.getElementById('beta_builds');
    let betaStartBuild = subtractFromBetaBuild(betaFirstAffected, dropdownBuildToVal(betaStartBuildElem.options[betaStartBuildElem.selectedIndex].value));
    let betaPushlogLink = 'https://hg.mozilla.org/releases/mozilla-beta/pushloghtml?fromchange=' + betaBuildToTag(betaStartBuild) + '&tochange=' + betaBuildToTag(betaFirstAffected);

    let betaPushlogLinkElem = document.getElementById('beta_pushloglink');
    betaPushlogLinkElem.textContent = betaPushlogLinkElem.href = betaPushlogLink;
    pushlog_links.push(betaPushlogLink);
  }


  return Promise.all(
    pushlog_links
    .map(link => 
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
    getCommonLandings()
    .then(bugs => {
      if (bugs.length === 0) {
        document.getElementById('results').textContent = 'None';
      }

      let ul = document.createElement('ul');
      for (let bug of bugs) {
        fetch('https://bugzilla.mozilla.org/rest/bug/' + bug + '?include_fields=summary')
        .then(response => response.json())
        .then(bugData => {
          let li = document.createElement('li');
          let a = document.createElement('a');
          a.textContent = bug + ' - ' + (('bugs' in bugData) ? bugData['bugs'][0]['summary'] : 'Unaccessible');
          a.href = 'https://bugzilla.mozilla.org/show_bug.cgi?id=' + bug;
          li.appendChild(a);
          ul.appendChild(li);
        });
      }

      document.getElementById('results').appendChild(ul);
    });
  };
});

