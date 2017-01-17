let onLoad = new Promise(function(resolve, reject) {
  window.onload = resolve;
});

function getCommonLandings() {
  let pushlog_links = [];

  for (let i = 1; i < 4; i++) {
    let pushlog_link = document.getElementById('pushloglink' + i).value;
    if (pushlog_link) {
      pushlog_links.push(pushlog_link);
    }
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
  });
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

