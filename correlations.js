var correlations = (() => {
  let correlationData;

  function sha1(str) {
    return crypto.subtle.digest('SHA-1', new TextEncoder('utf-8').encode(str))
    .then(hash => hex(hash));
  }

  function hex(buffer) {
    let hexCodes = [];
    let view = new DataView(buffer);

    for (let i = 0; i < view.byteLength; i += 4) {
      // Using getUint32 reduces the number of iterations needed (we process 4 bytes each time).
      let value = view.getUint32(i);
      // toString(16) will give the hex representation of the number without padding.
      let stringValue = value.toString(16);
      // We use concatenation and slice for padding.
      let padding = '00000000';
      let paddedValue = (padding + stringValue).slice(-padding.length);
      hexCodes.push(paddedValue);
    }

    // Join all the hex strings into one
    return hexCodes.join('');
  }

  function loadChannelsData() {
    if (correlationData) {
      return Promise.resolve();
    }

    return fetch('https://analysis-output.telemetry.mozilla.org/top-signatures-correlations/data/all.json.gz')
    .then(response => response.json())
    .then(totals => {
        correlationData = {
          'date': totals['date'],
        };

        for (let ch of ['release', 'beta', 'aurora', 'nightly']) {
          correlationData[ch] = {
            'total': totals[ch],
            'signatures': {},
          }
        }
    });
  }

  function loadCorrelationData(signature, channel) {
    return loadChannelsData()
    .then(() => {
      if (signature in correlationData[channel]['signatures']) {
        return;
      }

      return sha1(signature)
      .then(sha1signature => fetch('https://analysis-output.telemetry.mozilla.org/top-signatures-correlations/data/' + channel + '/' + sha1signature + '.json.gz'))
      .then(response => response.json())
      .then(data => {
        correlationData[channel]['signatures'][signature] = data;
      })
      .catch(() => {});
    })
    .then(() => correlationData);
  }

  function getAnalysisDate() {
    return loadChannelsData()
    .then(() => correlationData['date']);
  }

  function itemToLabel(item) {
    return Object.getOwnPropertyNames(item)
    .map(key => key + ' = ' + item[key])
    .join(' ∧ ');
  }

  function toPercentage(num) {
    let result = (num * 100).toFixed(2);

    if (result == '100.00') {
      return '100.0'
    }

    if (result.substring(0, result.indexOf('.')).length == 1) {
      return '0' + result;
    }

    return result;
  }

  function sortCorrelationData(correlationData, total_a, total_b) {
    return correlationData
    .sort((a, b) => {
      let rule_a_len = Object.keys(a.item).length;
      let rule_b_len = Object.keys(b.item).length;

      if (rule_a_len < rule_b_len) {
        return -1;
      }

      if (rule_a_len > rule_b_len) {
        return 1;
      }

      return Math.abs(b.count_b / total_b - b.count_a / total_a) - Math.abs(a.count_b / total_b - a.count_a / total_a);
    });
  }

  function text(textElem, signature, channel) {
    loadCorrelationData(signature, channel)
    .then(data => {
      textElem.textContent = '';

      if (!(signature in data[channel]['signatures']) || !data[channel]['signatures'][signature]['results']) {
        textElem.textContent = 'No correlation data was generated for the signature "' + signature + '" on the ' + channel + ' channel.'
        return;
      }

      let correlationData = data[channel]['signatures'][signature]['results'];

      let total_a = data[channel].total;
      let total_b = data[channel]['signatures'][signature].total;

      textElem.textContent = sortCorrelationData(correlationData, total_a, total_b)
      .reduce((prev, cur) =>
        prev + '(' + toPercentage(cur.count_b / total_b) + '% in signature vs ' + toPercentage(cur.count_a / total_a) + '% overall) ' + itemToLabel(cur.item) + '\n'
      , '');
    });
  }

  function graph(svgElem, signature, channel) {
    loadCorrelationData(signature, channel)
    .then(data => {
      d3.select(svgElem).selectAll('*').remove();

      if (!(signature in data[channel]['signatures']) || !data[channel]['signatures'][signature]['results']) {
        return;
      }

      let total_a = data[channel].total;
      let total_b = data[channel]['signatures'][signature].total;

      let correlationData = data[channel]['signatures'][signature]['results']
      .filter(elem => Object.keys(elem.item).length <= 1);
      correlationData = sortCorrelationData(correlationData, total_a, total_b);
      correlationData.reverse();

      let margin = { top: 20, right: 300, bottom: 30, left: 300 };
      let width = svgElem.getAttribute('width') - margin.left - margin.right;
      let height = svgElem.getAttribute('height') - margin.top - margin.bottom;

      let y0 = d3.scale.ordinal()
          .rangeRoundBands([height, 0], .2, 0.5);

      let y1 = d3.scale.ordinal();

      let x = d3.scale.linear()
          .range([0, width]);

      let color = d3.scale.ordinal()
          .range(['blue', 'red']);

      let xAxis = d3.svg.axis()
          .scale(x)
          .tickSize(-height)
          .orient('bottom');

      let yAxis = d3.svg.axis()
          .scale(y0)
          .orient('left');

      let svg = d3.select(svgElem)
          .attr('width', width + margin.left + margin.right)
          .attr('height', height + margin.top + margin.bottom)
          .append('g')
          .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      let options = [signature, 'Overall'];

      correlationData.forEach(d => {
        d.values = [
          { name: 'Overall', value: d.count_a / total_a },
          { name: signature, value: d.count_b / total_b },
        ]
      });

      y0.domain(correlationData.map(d => itemToLabel(d.item)));
      y1.domain(options).rangeRoundBands([0, y0.rangeBand()]);
      x.domain([0, 100]);

      svg.append('g')
         .attr('class', 'x axis')
         .attr('transform', 'translate(0,' + height + ')')
         .call(xAxis);

      svg.append('g')
         .attr('class', 'y axis')
         .call(yAxis);

      let bar = svg.selectAll('.bar')
          .data(correlationData)
          .enter().append('g')
          .attr('class', 'rect')
          .attr('transform', d => 'translate( 0,'+ y0(itemToLabel(d.item)) +')');

      let bar_enter = bar.selectAll('rect')
          .data(d => d.values)
          .enter()

      bar_enter.append('rect')
          .attr('height', y1.rangeBand())
          .attr('y', d => y1(d.name))
          .attr('x', d => 0)
          .attr('value', d => d.name)
          .attr('width', d => x((d.value * 100).toFixed(2)))
          .style('fill', d => color(d.name));

      bar_enter.append('text')
          .attr('x', d => x((d.value * 100).toFixed(2)) + 5)
          .attr('y', d => y1(d.name) + (y1.rangeBand()/2))
          .attr('dy', '.35em')
          .text(d => (d.value * 100).toFixed(2));

      let legend = svg.selectAll('.legend')
          .data(options.slice())
          .enter().append('g')
          .attr('class', 'legend')
          .attr('transform', (d, i) => 'translate(' + margin.right + ',' + i * 20 + ')');

      legend.append('rect')
          .attr('x', width - 18)
          .attr('width', 18)
          .attr('height', 18)
          .style('fill', color);

      legend.append('text')
          .attr('x', width - 24)
          .attr('y', 9)
          .attr('dy', '.35em')
          .style('text-anchor', 'end')
          .text(d => d);
    });
  }

  return {
    getAnalysisDate: getAnalysisDate,
    text: text,
    graph: graph,
  };
})();
