var correlations = (() => {
  let correlationData = {};

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

  function getDataURL(product) {
    if (product === 'Firefox') {
      return 'https://analysis-output.telemetry.mozilla.org/top-signatures-correlations/data/';
    } else if (product === 'FennecAndroid') {
      return 'https://analysis-output.telemetry.mozilla.org/top-fennec-signatures-correlations/data/';
    } else {
      throw new Error('Unknown product: ' + product);
    }
  }

  function loadChannelsData(product) {
    if (correlationData[product]) {
      return Promise.resolve();
    }

    return fetch(getDataURL(product) + 'all.json.gz')
    .then(response => response.json())
    .then(totals => {
      correlationData[product] = {
        'date': totals['date'],
      };

      let channels = ['release', 'beta', 'aurora', 'nightly'];
      if (product === 'Firefox') {
        channels.push('esr');
      }

      for (let ch of channels) {
        correlationData[product][ch] = {
          'total': totals[ch],
          'signatures': {},
        }
      }
    });
  }

  function loadCorrelationData(signature, channel, product) {
    return loadChannelsData(product)
    .then(() => {
      if (signature in correlationData[product][channel]['signatures']) {
        return;
      }

      return sha1(signature)
      .then(sha1signature => fetch(getDataURL(product) + channel + '/' + sha1signature + '.json.gz'))
      .then(response => response.json())
      .then(data => {
        correlationData[product][channel]['signatures'][signature] = data;
      });
    })
    .catch(() => {})
    .then(() => correlationData);
  }

  function getAnalysisDate(product) {
    return loadChannelsData(product)
    .then(() => correlationData[product]['date'])
    .catch(() => '');
  }

  function itemToLabel(item) {
    return Object.getOwnPropertyNames(item)
    .map(key => key + ' = ' + item[key])
    .join(' ∧ ');
  }

  function toPercentage(num) {
    let result = (num * 100).toFixed(2);

    if (result == '100.00') {
      return '100.0';
    }

    if (result.substring(0, result.indexOf('.')).length == 1) {
      return '0' + result;
    }

    return result;
  }

  function confidenceInterval(count1, total1, count2, total2) {
    let prop1 = count1 / total1;
    let prop2 = count2 / total2;
    let diff = prop1 - prop2;

    // Wald 95% confidence interval for the difference between the proportions.
    let standard_error = Math.sqrt(prop1 * (1 - prop1) / total1 + prop2 * (1 - prop2) / total2);
    let ci = [diff - 1.96 * standard_error, diff + 1.96 * standard_error];

    // Yates continuity correction for the confidence interval.
    let correction = 0.5 * (1.0 / total1 + 1.0 / total2);

    return [ci[0] - correction, ci[1] + correction];
  }

  function sortCorrelationData(correlationData, total_reference, total_group) {
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

      // Then, sort by percentage difference between signature and
      // overall (using the lower endpoint of the confidence interval
      // of the difference).
      let ciA = null;
      if (a.prior) {
        // If one of the two elements has a prior that alters a rule's
        // distribution significantly, sort by the percentage of the rule
        // given the prior.
        ciA = confidenceInterval(a.prior.count_group, a.prior.total_group, a.prior.count_reference, a.prior.total_reference);
      }
      else {
        ciA = confidenceInterval(a.count_group, total_group, a.count_reference, total_reference);
      }

      let ciB = null;
      if (b.prior) {
        ciB = confidenceInterval( b.prior.count_group, b.prior.total_group, b.prior.count_reference, b.prior.total_reference);
      }
      else {
        ciB = confidenceInterval(b.count_group, total_group, b.count_reference, total_reference);
      }

      return Math.min(Math.abs(ciB[0]), Math.abs(ciB[1])) - Math.min(Math.abs(ciA[0]), Math.abs(ciA[1]));
    });
  }

  function itemEqual(item1, item2) {
    let keys1 = Object.keys(item1);
    let keys2 = Object.keys(item2);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (let prop of keys1.concat(keys2)) {
      let val1 = item1[prop];
      let val2 = item2[prop];

      if (typeof val1 === 'string') {
        val1 = val1.toLowerCase();
      }

      if (typeof val2 === 'string') {
        val2 = val2.toLowerCase();
      }

      if (item1[prop] !== item2[prop]) {
        return false;
      }
    }

    return true;
  }

  let channelsData = {};

  function loadChannelsDifferencesData(product) {
    return fetch('https://analysis-output.telemetry.mozilla.org/channels-differences/data/differences.json.gz')
    .then(response => response.json())
    .then(data => channelsData = data);
  }

  function socorroToTelemetry(socorroKey, socorroValue) {
    let valueMapping = {
      'cpu_arch': {
        values: {
          'amd64': 'x86-64',
        },
      },
      'os_arch': {
        values: {
          'amd64': 'x86-64',
        },
      },
      'platform': {
        key: 'os_name',
        values: {
          'Mac OS X': 'Darwin',
          'Windows NT': 'Windows_NT',
        }
      },
      'platform_version': {
        key: 'os_version',
      },
      'platform_pretty_version': {
        key: 'os_pretty_version',
        values: {
          'Windows 10': '10.0',
          'Windows 8.1': '6.3',
          'Windows 8': '6.2',
          'Windows 7': '6.1',
          'Windows Server 2003': '5.2',
          'Windows XP': '5.1',
          'Windows 2000': '5.0',
          'Windows NT': '4.0',
        }
      },
      'e10s_enabled': {
        key: 'e10s_enabled',
        values: {
          '1': true,
        }
      },
      'dom_ipc_enabled': {
        key: 'e10s_enabled',
        values: {
          '1': true,
        }
      },
      '"D2D1.1+" in app_notes': {
        key: 'd2d_enabled',
      },
      '"D2D1.1-" in app_notes': {
        key: 'd2d_enabled',
        values: v => !v,
      },
      '"DWrite+" in app_notes': {
        key: 'd_write_enabled',
      },
      '"DWrite-" in app_notes': {
        key: 'd_write_enabled',
        values: v => !v,
      },
      'adapter_vendor_id': {
        values: {
          'NVIDIA Corporation': '0x10de',
          'Intel Corporation': '0x8086',
        },
      },
      'CPU Info': {
        key: 'cpu_info',
      }
    };

    let key, value;
    if (socorroKey in valueMapping) {
      let mapping = valueMapping[socorroKey];
      key = mapping['key'] || socorroKey;
      if (mapping['values']) {
        if (typeof mapping['values'] === 'function') {
          value = mapping['values'](socorroValue);
        } else {
          value = mapping['values'][socorroValue];
        }
      }
    }

    if (typeof key === 'undefined') {
      key = socorroKey;
    }

    if (typeof value === 'undefined') {
      value = socorroValue;
    }

    return [key, value];
  }

  function getChannelPercentage(channel, socorroItem) {
    // console.log('socorro')
    // console.log(socorroItem)

    let translatedItem = {};
    for (let prop of Object.keys(socorroItem)) {
      let [telemetryProp, telemetryValue] = socorroToTelemetry(prop, socorroItem[prop]);
      //console.log(telemetryProp + ' - ' + telemetryValue)
      translatedItem[telemetryProp] = telemetryValue;
    }

    // console.log('translated')
    // console.log(translatedItem)

    let found = channelsData[channel].find(longitudinalElem => itemEqual(longitudinalElem.item, translatedItem));
    if (!found) {
      return 0;
    }

    // console.log('telemetry ' + channel)
    // console.log(found)

    /*console.log('cpu_info');
    console.log(channelsData[channel].filter(longitudinalElem => Object.keys(longitudinalElem.item).indexOf('cpu_info') != -1));*/

    return found.p;
  }

  function rerank(textElem, signature, channel, channel_target, product) {
    textElem.textContent = '';

    return loadChannelsDifferencesData(product)
    .then(() => loadCorrelationData(signature, channel, product))
    .then(data => {
      if (!(product in data)) {
        textElem.textContent = 'No correlation data was generated for the \'' + product + '\' product.';
        return [];
      }

      if (!(signature in data[product][channel]['signatures']) || !data[product][channel]['signatures'][signature]['results']) {
        textElem.textContent = 'No correlation data was generated for the signature "' + signature + '" on the ' + channel + ' channel, for the \'' + product + '\' product.';
        return [];
      }

      let correlationData = data[product][channel]['signatures'][signature]['results'];

      let total_reference = data[product][channel].total;
      let total_group = data[product][channel]['signatures'][signature].total;

      return correlationData
      .filter(socorroElem => Object.keys(socorroElem.item).length == 1)
      .filter(socorroElem => getChannelPercentage(channel, socorroElem.item) != 0)
      .sort((a, b) => {
        //return getChannelPercentage(channel_target, b.item) / getChannelPercentage(channel, b.item) - getChannelPercentage(channel_target, a.item) / getChannelPercentage(channel, a.item);
        return b.count_group / total_group - a.count_group / total_group;
      })
      .map(elem => {
        return {
          property: itemToLabel(elem.item),
          in_signature: toPercentage(elem.count_group / total_group),
          in_channel_target: getChannelPercentage(channel_target, elem.item),
          in_channel: getChannelPercentage(channel, elem.item),
        };
      });
    });
  }

  function text(textElem, signature, channel, product, show_ci=false) {
    loadCorrelationData(signature, channel, product)
    .then(data => {
      textElem.textContent = '';

      if (!(product in data)) {
        textElem.textContent = 'No correlation data was generated for the \'' + product + '\' product.';
        return;
      }

      if (!(signature in data[product][channel]['signatures']) || !data[product][channel]['signatures'][signature]['results']) {
        textElem.textContent = 'No correlation data was generated for the signature "' + signature + '" on the ' + channel + ' channel, for the \'' + product + '\' product.';
        return;
      }

      let correlationData = data[product][channel]['signatures'][signature]['results'];

      let total_reference = data[product][channel].total;
      let total_group = data[product][channel]['signatures'][signature].total;

      textElem.textContent = sortCorrelationData(correlationData, total_reference, total_group)
      .reduce((prev, cur) => {
        let support_group = toPercentage(cur.count_group / total_group);
        let support_reference = toPercentage(cur.count_reference / total_reference);
        let support_diff = toPercentage(Math.abs(cur.count_group / total_group - cur.count_reference / total_reference));

        let ci = confidenceInterval(cur.count_group, total_group, cur.count_reference, total_reference);

        let support_diff_incertezza = toPercentage(Math.abs(Math.abs(ci[0]) - Math.abs(cur.count_group / total_group - cur.count_reference / total_reference)));

        let res = prev + '(' + support_group + '% in signature vs ' + support_reference + '% overall, difference ' + support_diff + '±' + support_diff_incertezza + '%) ' + itemToLabel(cur.item)

        if (cur.prior) {
          let support_group_given_prior = toPercentage(cur.prior.count_group / cur.prior.total_group);
          let support_reference_given_prior = toPercentage(cur.prior.count_reference / cur.prior.total_reference);
          res += ' [' + support_group_given_prior + '% vs ' + support_reference_given_prior + '% if ' + itemToLabel(cur.prior.item) + ']'
        }

        return res + '\n';
      }, '');

      textElem.textContent += '\n\nTop Words: ' + data[product][channel]['signatures'][signature]['top_words'].join(', ');
    });
  }

  function graph(svgElem, signature, channel, product) {
    loadCorrelationData(signature, channel, product)
    .then(data => {
      d3.select(svgElem).selectAll('*').remove();

      if (!(product in data) || !(signature in data[product][channel]['signatures']) || !data[product][channel]['signatures'][signature]['results']) {
        return;
      }

      let total_reference = data[product][channel].total;
      let total_group = data[product][channel]['signatures'][signature].total;

      let correlationData = data[product][channel]['signatures'][signature]['results']
      .filter(elem => Object.keys(elem.item).length <= 1);
      correlationData = sortCorrelationData(correlationData, total_reference, total_group);
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
          { name: 'Overall', value: d.count_reference / total_reference },
          { name: signature, value: d.count_group / total_group },
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
    rerank: rerank,
    toPercentage: toPercentage,
    graph: graph,
  };
})();
