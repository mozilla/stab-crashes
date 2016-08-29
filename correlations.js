var correlations = (() => {
  let correlationData;

  function loadCorrelationData() {
    if (correlationData) {
      return Promise.resolve(correlationData);
    }

    return fetch('https://analysis-output.telemetry.mozilla.org/top-signatures-correlations/data/top_results.json.gz')
    .then(response => response.json())
    .then(data => {
      correlationData = data;
      return data;
    });
  }

  function itemToLabel(item) {
    return Object.getOwnPropertyNames(item)
    .map(key => key + ' = ' + item[key])
    .join(' ∧ ');
  }

  function text(textElem, signature, channel) {
    loadCorrelationData()
    .then(data => {
      textElem.textContent = '';

      let correlationData = data[channel][signature];
      if (!correlationData) {
        textElem.textContent = 'No correlation data was generated for this signature on this channel.'
        return;
      }

      textElem.textContent = correlationData
      .sort((a, b) => Math.abs(b.support_b - b.support_a) - Math.abs(a.support_b - a.support_a))
      .reduce((prev, cur) =>
        prev + itemToLabel(cur.item) + ' (' + (cur.support_b * 100).toFixed(2) + '% vs ' + (cur.support_a * 100).toFixed(2) + '%)\n'
        , '');
    });
  }

  function graph(svgElem, totalWidth, totalHeight, signature, channel) {
    loadCorrelationData()
    .then(data => {
      d3.select(svgElem).selectAll('*').remove();

      let correlationData = data[channel][signature];
      if (!correlationData) {
        return;
      }

      let margin = { top: 20, right: 300, bottom: 30, left: 300 };
      let width = totalWidth - margin.left - margin.right;
      let height = totalHeight - margin.top - margin.bottom;

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

      let options = ['Overall', signature];

      correlationData.forEach(d => {
        d.values = [
          { name: 'Overall', value: d.support_a },
          { name: signature, value: d.support_b },
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
    text: text,
    graph: graph,
  };
})();
