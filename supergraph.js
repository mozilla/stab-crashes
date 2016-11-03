/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

function cleanFunc(func) {
  let dllIndex = func.indexOf('.dll@');

  if (dllIndex != -1) {
    return func.substring(0, dllIndex + 4);
  }

  return func;
}

function generateGraph(signature) {
  if (!signature) {
    return;
  }

  let query;

  if (signature.startsWith('https://crash-stats.mozilla.com/')) {
    if (signature.startsWith('https://crash-stats.mozilla.com/search/')) {
      signature = 'https://crash-stats.mozilla.com/api/SuperSearch/' + signature.substring('https://crash-stats.mozilla.com/search/'.length);
    }

    query = new URL(signature);

    query.searchParams.set('_facets', 'proto_signature');
    query.searchParams.set('_facets_size', 50);
    query.searchParams.set('_results_number', 0);
  } else {
    query = new URL('https://crash-stats.mozilla.com/api/SuperSearch/?signature=%3D' + signature + '&_results_number=0&_facets=proto_signature&_facets_size=50');
  }

  console.log(query.href)

  fetch(query.href)
  .then(response => response.json())
  .then(data => {
    let addedNodes = new Set();
    let addedEdges = new Set();

    for (let proto_signature of data['facets']['proto_signature']) {
      let funcs = proto_signature['term'].split(' | ');

      for (let i = funcs.length - 1; i > 0; i--) {
        let func = cleanFunc(funcs[i]);

        addedNodes.add(func);

        if (i != 0) {
          addedEdges.add(func + '|' + cleanFunc(funcs[i - 1]))
        }
      }
    }

    let nodes = [];
    for (let node of addedNodes) {
      nodes.push({
        id: node,
        label: node,
      });
    }

    let edges = [];
    for (let edge of addedEdges) {
      let from_to = edge.split('|');
      edges.push({
        from: from_to[0],
        to: from_to[1],
      });
    }

    console.log(nodes.length)
    console.log(edges.length)

    var data = {
      'nodes': nodes,
      'edges': edges,
    };

    var opts = {
      layout: {
        hierarchical: {
          direction: 'UD',
          sortMethod: 'directed',
          //levelSeparation: 50,
          nodeSpacing: 1,
          blockShifting: true,
        },
      },
      edges: {
        arrows: {
          to: true,
        },
      },
      nodes: {
        shape: 'box',
        font: {
          face: 'monospace',
        },
      },
    };

    let network = new vis.Network(document.getElementById('graph'), data, opts);

    network.on("stabilizationIterationsDone", function () {
      network.setOptions({
        physics: false,
      });
    });
  });
}

new Promise((resolve, reject) => window.onload = resolve)
.then(function() {
  let elem = document.getElementById('signature');

  let queryVars = new URL(location.href).search.substring(1).split('&');

  for (let queryVar of queryVars) {
    if (queryVar.startsWith('s=')) {
      elem.value = decodeURIComponent(queryVar.substring(('s=').length));
      break;
    }
  }

  document.getElementById('signatureButton').onclick = function() {
    let s = elem.value.trim();
    let url = new URL(location.href);
    url.searchParams.set('s', s);
    history.replaceState({}, document.title, url.href);
    generateGraph(s);
  };

  generateGraph(elem.value.trim());
})
.catch(function(err) {
  console.error(err);
});
