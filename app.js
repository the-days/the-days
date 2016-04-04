/**
json data format
{"STATION":{"LONGITUDE":116.587,"LATITUDE":40.074,"ELEVATION":55,"NAME":"Beijing","CODE":"ZBAA"},
"DATA": [[minTemperature], [maxTemperature], [Precipitation], [DatetimeValue]]}

Quantity Metric:
minTemperature: \[Degree]C
maxTemperature: \[Degree]C
Precipitation: cm
DatetimeValue: YYYYMMDD
*/
var api = `Shanghai.json`,
  margin = 20,
  width = Math.min(window.innerWidth, 1.3 * window.innerHeight) - margin,
  height = window.innerHeight - margin,
  lowest = -40,
  highest = 60,
  maxPRCP = 200,
  maxPRCPRadius = width / 16,
  svg = d3.select('svg').attr('width', width).attr('height', height);
  // remove body unresolved when width and height is setup
  d3.select('#app').attr('unresolved', null);
origin = svg.append('g')
  .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')'),
  rScale = d3.scale.linear()
  .domain([lowest, highest])
  .range([0, height / 2 - margin]),
  yScale = function(day, temp) {
    return -Math.cos(angleScale(day) * Math.PI / 180) * rScale(parseInt(temp))
  },
  xScale = function(day, temp) {
    return Math.sin(angleScale(day) * Math.PI / 180) * rScale(parseInt(temp))
  },
  angleScale = d3.scale.linear()
  .range([0, 360]);

var drawRadial = function(chart, cl, data, low, high) {
  /* define gradients */
  var gradient = origin.
  append('defs').append('radialGradient')
    .attr('gradientUnits', 'userSpaceOnUse')
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('r', '33%')
    .attr('id', `heatGradient`)
  gradient.append('stop').attr('offset', '0%').attr('stop-color', 'rgb(0,24,35)');
  gradient.append('stop').attr('offset', '15%').attr('stop-color', 'rgb(0,59,93)');
  gradient.append('stop').attr('offset', '35%').attr('stop-color', 'rgb(30,107,154)');
  gradient.append('stop').attr('offset', '60%').attr('stop-color', 'rgb(81,183,231)');
  gradient.append('stop').attr('offset', '70%').attr('stop-color', 'rgb(147,222,168)');
  gradient.append('stop').attr('offset', '80%').attr('stop-color', 'rgb(253,212,95)');
  gradient.append('stop').attr('offset', '93%').attr('stop-color', 'rgb(230,108,86)');
  gradient.append('stop').attr('offset', '100%').attr('stop-color', 'rgb(105, 37, 19)');
  /* draw temperature and precipitation */
  var maxPRCP = d3.max(data, d => parseInt(d.PRCP));

  data.forEach(d => {
    /* scale x and y */
    var x1 = xScale(d.index, d[low]),
      x2 = xScale(d.index, d[high]),
      y1 = yScale(d.index, d[low]),
      y2 = yScale(d.index, d[high]);
    /* draw precipitation */
    var cx = (x1 + x2) / 2,
      cy = (y1 + y2) / 2;
    // var opacity = 0.2 + ( 1 - (d.PRCP / maxPRCP) ) * 0.6;
    chart.append('circle').attr('cx', cx).attr('cy', cy)
    .attr('r', d.PRCP / maxPRCP * maxPRCPRadius)
    .attr('class', 'precipitation')
  });
  data.forEach(d => {
    /* scale x and y */
    var x1 = xScale(d.index, d[low]),
      x2 = xScale(d.index, d[high]),
      y1 = yScale(d.index, d[low]),
      y2 = yScale(d.index, d[high]);
    /* draw temperature */
    chart.append('line')
      .attr('x1', x1)
      .attr('x2', x2)
      .attr('y1', y1)
      .attr('y2', y2)
      .attr('class', cl).style('stroke', `url(#heatGradient)`);
  })
};
var mathematica_preprocess = function(json) {
  var data = json.DATA;
  return data[3].map((v, k) => ({
    DATE: v,
    TMIN: data[0][k],
    TMAX: data[1][k],
    PRCP: data[2][k] * 10
  }));
}
d3.json(api, function(err, json) {
  json.DATA = mathematica_preprocess(json);
  angleScale.domain([0, json.DATA.length - 1]);
  json.DATA.forEach((_, k, arr) => {
    arr[k].min = arr[k].TMIN;
    arr[k].max = arr[k].TMAX;
    arr[k].index = k;
  });
  var min = d3.min(json.DATA, d => parseInt(d.min)),
    max = d3.max(json.DATA, d => parseInt(d.max));
  var months = [];
  //find index for months based on data
  json.DATA.forEach((d, i) => {
    var day = moment(d.DATE, 'YYYYMMDD');
    if (day.date() === 1) {
      months.push({
        month: day.format('MMM').toUpperCase(),
        index: i
      })
    }
  })

  //circle axis
  origin.selectAll('circle.axis')
    .data(d3.range(lowest + 20, highest - 10, 10))
    .enter().append('circle')
    .attr('r', function(d) {
      return rScale(d)
    })
    .attr('class', 'axis record')

  //axis lines
  var axis = origin.append('g');

  axis.selectAll('line.axis')
    .data(months)
    .enter().append('line')
    .attr('x2', function(d) {
      return xScale(d.index, 41)
    })
    .attr('y2', function(d) {
      return yScale(d.index, 41)
    })
    .attr('class', 'axis');
  axis.selectAll('line.tick')
    .data(months)
    .enter().append('line')
    .attr('x1', d => xScale(d.index, highest - 17))
    .attr('y1', d => yScale(d.index, highest - 17))
    .attr('x2', d => xScale(d.index, highest - 10.2))
    .attr('y2', d => yScale(d.index, highest - 10.2))
    .attr('class', 'tick')

  var monthLabels = months
  axis.selectAll('text.months')
    .data(monthLabels)
    .enter().append('text')
    .attr('x', function(d) {
      return xScale(0, highest - 12)
    })
    .attr('y', function(d) {
      return yScale(0, highest - 12)
    })
    .attr('dx', '.25em')
    .attr('transform', (d) => {
      return `rotate(${angleScale(d.index)})`;
    })
    .text(function(d) {
      return d.month
    })
    .attr('class', 'months')
    .style('font-size', 0.013 * height)

  //temperature axis labels
  var circleAxis = d3.range(lowest + 20, highest, 20)
    .reduce(function(p, d) {
      return p.concat([{
        temp: d,
        index: 180
      }, {
        temp: d,
        index: 0
      }])
    }, []);

  var textPadding = {
    dx: 2*window.innerWidth/100,
    dy: 1.4*window.innerHeight/100
  };
  origin.selectAll('text.temp')
    .data(circleAxis)
    .enter().append('rect')
    .attr('x', function(d) {
      return xScale(d.index, d.temp) - textPadding.dx
    })
    .attr('y', function(d) {
      return yScale(d.index, d.temp) - textPadding.dy
    })
    .attr('width', 2 * textPadding.dx)
    .attr('height', 2 * textPadding.dy)
    .style('fill', '#fff')

  origin.selectAll('text.temp')
    .data(circleAxis)
    .enter().append('text')
    .attr('x', function(d) {
      return xScale(d.index, d.temp)
    })
    .attr('y', function(d) {
      return yScale(d.index, d.temp)
    })
    .text(function(d) {
      return d.temp + '°C'
    })
    .attr('class', 'temp')
    .style('font-size', 0.013 * height)
  //temperature and precipitation

  //this year's temperature
  var thisYear = json.DATA.filter(function(d) {
    return d.min
  });

  drawRadial(origin, 'year', thisYear, 'min', 'max')

  //title
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height / 2)
    .text(json.STATION.NAME)
    .attr('class', 'title')
    .style('font-size', 0.036 * height)

  // geolocation
  var geolocation =
    (json.STATION.LONGITUDE > 0 ? `${json.STATION.LONGITUDE.toFixed(4)}° E` : `${-json.STATION.LONGITUDE.toFixed(4)}° W`) + '  ' + (json.STATION.LATITUDE > 0 ? `${json.STATION.LATITUDE.toFixed(4)}° N` : `${-json.STATION.LATITUDE.toFixed(4)}° S`) + '  ' + `${json.STATION.ELEVATION}m`;
  svg.append('text').attr('x', width - margin)
    .attr('y', height - margin)
    .text(geolocation)
    .attr('class', 'footnote')
    .style('font-size', 0.018 * height)

  var code = json.STATION.CODE;
  svg.append('text').attr('x', width - margin)
    .attr('y', height - margin).attr('dy', -margin)
    .text(code)
    .attr('class', 'footnote')
    .style('font-size', 0.018 * height)

  svg.attr('title', json.STATION.NAME)
});

Mousetrap.bind(['command+s', 'ctrl+s'], function saveRadialAsSVG() {
  var domNode = document.getElementsByTagName('svg')[0];
  var fileName = d3.select(domNode).attr('title') + '.svg';
  saveAsSVG(domNode, fileName);
  return false;
});

/**
 * save as svg file given DOM node and fileName
 * @param domNode the DOM node that should be save as svg
 * @param fileName the expected file name saved to local filesystem
 */
var saveAsSVG = function(domNode, fileName) {
  var serializer = new XMLSerializer();
  var svgBlob = new Blob(
    [serializer.serializeToString(domNode)], { type: 'image/svg+xml' }
  );
  saveAs(svgBlob, fileName);
}
