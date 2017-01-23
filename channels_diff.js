let options = {
  'property': {
    value: null,
    type: 'option',
  },
  'value': {
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

function setURL() {
  let url = new URL(location.href);

  let property = getOption('property');
  let value = getOption('value');
  if (!property) {
    url.search = '';
  } else if (!value) {
    url.search = '?property=' + property;
  } else {
    url.search = '?property=' + property + '&value=' + value;
  }

  history.replaceState({}, document.title, url.href);
}

function populateTable() {
  let property = getOption('property');
  let value = getOption('value');
  if (!property || !value) {
    return;
  }

  let channels = ['nightly', 'aurora', 'beta', 'release'];

  let results = {};

  Promise.all(
    channels
    .map((channel, index) =>
      correlations.getChannelsPercentage('Firefox', channel, property, value)
      .then(result => results[channel] = result)
    )
  )
  .then(() => {
    let table = document.getElementById('table');
    while (table.rows.length > 1) {
      table.deleteRow(table.rows.length - 1);
    }

    let row = table.insertRow(table.rows.length);

    channels.forEach((channel, index) => {
      let cell = row.insertCell(index);
      cell.appendChild(document.createTextNode(correlations.toPercentage(results[channel] && results[channel].p || 0) + ' %'));
    });

    let svgElem = document.getElementById('image'); 

    d3.select(svgElem).selectAll('*').remove();

    let margin = { top: 20, right: 300, bottom: 70, left: 300 };
    let width = svgElem.getAttribute('width') - margin.left - margin.right;
    let height = svgElem.getAttribute('height') - margin.top - margin.bottom;

    let x = d3.scale.ordinal().rangeRoundBands([0, width], .05);
    let y = d3.scale.linear().range([height, 0]);

    let color = d3.scale.ordinal()
      .range(['black', 'blue', 'red', 'orange']);

    let xAxis = d3.svg.axis()
      .scale(x)
      .orient("bottom");

    let yAxis = d3.svg.axis()
      .scale(y)
      .orient("left")
      .ticks(10);

    var svg = d3.select(svgElem)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform",  "translate(" + margin.left + "," + margin.top + ")");

    let data = channels.map(channel => {
      return {
        channel: channel,
        value: (results[channel] && results[channel].p || 0) * 100,
      };
    });

    x.domain(channels);
    y.domain([0, d3.max(data, function(d) { return d.value; })]);

    svg.append("g")
       .attr("class", "x axis")
       .attr("transform", "translate(27," + height + ")")
       .call(xAxis)
       .selectAll("text")
       .style("text-anchor", "end")
       .attr("dx", "-.8em")
       .attr("dy", "-.55em")
       .attr("transform", "rotate(-90)" );

    svg.append("g")
       .attr("class", "y axis")
       .call(yAxis)
       .append("text")
       .attr("transform", "rotate(-90)")
       .attr("y", 3)
       .attr("dy", ".71em")
       .style("text-anchor", "end")
       .text("Percentage of users (%)");

    svg.selectAll("bar")
       .data(data)
       .enter()
       .append("rect")
       .style('fill', d => color(d.channel))
       .attr("x", function(d) { return 27 + x(d.channel); })
       .attr("width", x.rangeBand())
       .attr("y", function(d) { return y(d.value); })
       .attr("height", function(d) { return height - y(d.value); });
  });
}

function populateValueSelect() {
  let property = getOption('property');
  if (!property) {
    return;
  }

  correlations.getChannelsValues('Firefox', property)
  .then(values => {
    if ($('#value')[0].selectize) {
      $('#value')[0].selectize.destroy();
    }

    let $select = $('#value').selectize({
      valueField: 'name',
      labelField: 'name',
      searchField: 'name',
      options: values.map(value => {
        return {'name': value};
      }),
      onChange: value => {
        setOption('value', value);
        setURL();
        populateTable();
      },
    });

    $select[0].selectize.setValue(getOption('value'));
  });
}

onLoad
.then(() => correlations.getChannelsProperties('Firefox'))
.then(props => {
  let queryVars = new URL(location.href).search.substring(1).split('&');

  Object.keys(options)
  .forEach(function(optionName) {
    for (let queryVar of queryVars) {
      if (queryVar.startsWith(optionName + '=')) {
        let option = queryVar.substring((optionName + '=').length).trim();
        setOption(optionName, decodeURIComponent(option));
      }
    }
  });

  let $select = $('#property').selectize({
    valueField: 'name',
    labelField: 'name',
    searchField: 'name',
    options: props.map(prop => {
      return {'name': prop};
    }),
    onChange: prop => {
      if (prop != getOption('property')) {
        setOption('value', '');
      }
      setOption('property', prop);
      setURL();
      populateValueSelect();
    },
  });

  $select[0].selectize.setValue(getOption('property'));
})
.catch(function(err) {
  console.error(err);
});
