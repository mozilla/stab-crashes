var correlationGraph = (function() {
  let correlationData;

  function loadCorrelationData() {
    if (correlationData) {
      return Promise.resolve(correlationData);
    }

    return fetch('https://analysis-output.telemetry.mozilla.org/top-100-signatures-correlations/data/top100_results.json.gz')
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      correlationData = data;
      return data;
    })
  }

  function itemToLabel(item) {
    return Object.getOwnPropertyNames(item)
    .map(function(key) {
      return key + ' = ' + item[key]
    })
    .join(' ∧ ');
  }

  function correlationGraph(svgElem, totalWidth, totalHeight, signature, channel) {
    loadCorrelationData()
    .then(function(data) {
      d3.select(svgElem).selectAll('*').remove();

      let dataset = data[channel][signature];

      let margin = {top: 20, right: 300, bottom: 30, left: 300};
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

      dataset.forEach(function(d) {
        d.valores = [
          { name: 'Overall', value: d.support_a },
          { name: signature, value: d.support_b },
        ]
      });

      y0.domain(dataset.map(function(d) { return itemToLabel(d.item); }));
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
          .data(dataset)
          .enter().append('g')
          .attr('class', 'rect')
          .attr('transform', function(d) { return 'translate( 0,'+ y0(itemToLabel(d.item)) +')'; });

      let bar_enter = bar.selectAll('rect')
          .data(function(d) { return d.valores; })
          .enter()

      bar_enter.append('rect')
          .attr('height', y1.rangeBand())
          .attr('y', function(d) { return y1(d.name); })
          .attr('x', function(d) { return 0; })
          .attr('value', function(d){return d.name;})
          .attr('width', function(d) { return x((d.value * 100).toFixed(2)); })
          .style('fill', function(d) { return color(d.name); });

      bar_enter.append('text')
          .attr('x', function(d) { return x((d.value * 100).toFixed(2)) + 5;  })
          .attr('y', function(d) { return y1(d.name) + (y1.rangeBand()/2); })
          .attr('dy', '.35em')
          .text(function(d) { return (d.value * 100).toFixed(2); });

      let legend = svg.selectAll('.legend')
          .data(options.slice())
          .enter().append('g')
          .attr('class', 'legend')
          .attr('transform', function(d, i) { return 'translate(' + margin.right + ',' + i * 20 + ')'; });

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
          .text(function(d) { return d; });
    });
  }

  return correlationGraph;
})();
