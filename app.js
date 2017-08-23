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
const api = `Shanghai.json`,
  margin = 20,
  WIDTH = Math.min(window.innerWidth, 1.3 * window.innerHeight) - margin,
  HEIGHT = window.innerHeight - margin,
  LOWEST = -40,
  HIGHEST = 60,
  maxPRCPRadius = WIDTH / 16;
const svg = d3.select("svg").attr("width", WIDTH).attr("height", HEIGHT);
// remove body unresolved when WIDTH and HEIGHT is setup
d3.select("#app").attr("unresolved", null);

const viewport = svg
  .append("g")
  .attr("class", "viewport")
  .attr("transform", "translate(" + WIDTH / 2 + "," + HEIGHT / 2 + ")");
const rScale = d3
  .scaleLinear()
  .domain([LOWEST, HIGHEST])
  .range([0, HEIGHT / 2 - margin]);
const yScale = (day, temp) =>
  -Math.cos(angleScale(day) * Math.PI / 180) * rScale(parseInt(temp));
const xScale = (day, temp) =>
  Math.sin(angleScale(day) * Math.PI / 180) * rScale(parseInt(temp));
const angleScale = d3.scaleLinear().range([0, 360]);

const generateRadialGradient = selection => {
  const gradientControl = [
    {
      offset: "0%",
      stopColor: "rgb(0,24,35)"
    },
    {
      offset: "15%",
      stopColor: "rgb(0,59,93)"
    },
    {
      offset: "35%",
      stopColor: "rgb(30,107,154)"
    },
    {
      offset: "60%",
      stopColor: "rgb(81,183,231)"
    },
    {
      offset: "70%",
      stopColor: "rgb(147,222,168)"
    },
    {
      offset: "80%",
      stopColor: "rgb(253,212,95)"
    },
    {
      offset: "93%",
      stopColor: "rgb(230,108,86)"
    },
    {
      offset: "100%",
      stopColor: "rgb(105,37,19)"
    }
  ];
  selection
    .selectAll("stop")
    .data(gradientControl)
    .enter()
    .append("stop")
    .attr("offset", d => d.offset)
    .attr("stop-color", d => d.stopColor);
};

const drawRadial = (chart, cl, data, low, high) => {
  /* define gradients */
  const gradient = viewport
    .append("defs")
    .append("radialGradient")
    .attr("gradientUnits", "userSpaceOnUse")
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", "33%")
    .attr("id", `heatGradient`);
  gradient.call(generateRadialGradient);
  /* draw temperature and precipitation */
  const maxPRCP = d3.max(data, d => parseInt(d.PRCP));

  data.forEach(d => {
    /* scale x and y */
    const x1 = xScale(d.index, d[low]),
      x2 = xScale(d.index, d[high]),
      y1 = yScale(d.index, d[low]),
      y2 = yScale(d.index, d[high]);
    /* draw precipitation */
    const cx = (x1 + x2) / 2,
      cy = (y1 + y2) / 2;
    // var opacity = 0.2 + ( 1 - (d.PRCP / maxPRCP) ) * 0.6;
    chart
      .append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", d.PRCP / maxPRCP * maxPRCPRadius)
      .attr("class", "precipitation");
  });
  data.forEach(d => {
    /* scale x and y */
    const x1 = xScale(d.index, d[low]),
      x2 = xScale(d.index, d[high]),
      y1 = yScale(d.index, d[low]),
      y2 = yScale(d.index, d[high]);
    /* draw temperature */
    chart
      .append("line")
      .attr("x1", x1)
      .attr("x2", x2)
      .attr("y1", y1)
      .attr("y2", y2)
      .attr("class", cl)
      .style("stroke", `url(#heatGradient)`);
  });
};

const renderAxis = axis => {
  axis
    .append("line")
    .attr("x2", d => xScale(d.index, 41))
    .attr("y2", d => yScale(d.index, 41))
    .attr("class", "axis-line");

  axis
    .append("line")
    .attr("x1", d => xScale(d.index, HIGHEST - 17))
    .attr("y1", d => yScale(d.index, HIGHEST - 17))
    .attr("x2", d => xScale(d.index, HIGHEST - 10.2))
    .attr("y2", d => yScale(d.index, HIGHEST - 10.2))
    .attr("class", "tick");

  axis
    .append("text")
    .attr("x", d => xScale(0, HIGHEST - 12))
    .attr("y", d => yScale(0, HIGHEST - 12))
    .attr("dx", ".25em")
    .attr("transform", d => {
      return `rotate(${angleScale(d.index)})`;
    })
    .text(d => d.month)
    .attr("class", "months")
    .style("font-size", 0.013 * HEIGHT);
};
const mathematica_preprocess = json => {
  const data = json.DATA;
  return data[3].map((v, k) => ({
    DATE: v,
    TMIN: data[0][k],
    TMAX: data[1][k],
    PRCP: data[2][k] * 10
  }));
};
d3.json(api, (err, json) => {
  json.DATA = mathematica_preprocess(json);
  angleScale.domain([0, json.DATA.length - 1]);
  json.DATA.forEach((_, k, arr) => {
    arr[k].min = arr[k].TMIN;
    arr[k].max = arr[k].TMAX;
    arr[k].index = k;
  });

  const months = [];
  //find index for months based on data
  json.DATA.forEach((d, i) => {
    const day = moment(d.DATE, "YYYYMMDD");
    if (i === 0 || !moment(json.DATA[i - 1].DATE).isSame(day, "month")) {
      months.push({
        month: day.format("MMM").toUpperCase(),
        index: i
      });
    }
  });

  //circle axis
  viewport
    .append("g")
    .attr("class", "circle-axis-container")
    .selectAll("circle.axis")
    .data(d3.range(LOWEST + 20, HIGHEST - 10, 10))
    .enter()
    .append("circle")
    .attr("r", d => rScale(d))
    .attr("class", "axis record");

  //axis lines
  const axisContainer = viewport.append("g").attr("class", "axis-container");

  axisContainer.selectAll(".axis").data(months).enter().call(renderAxis);

  //temperature axis labels
  const circleAxis = d3.range(LOWEST + 20, HIGHEST, 20).reduce(
    (p, d) =>
      p.concat([
        {
          temp: d,
          index: 180
        },
        {
          temp: d,
          index: 0
        }
      ]),
    []
  );

  const textPadding = {
    dx: 2 * window.innerWidth / 100,
    dy: 1.4 * window.innerHeight / 100
  };

  const temperatureLabel = viewport
    .append("g")
    .attr("class", "temperature-label-container")
    .selectAll("text.temperature")
    .data(circleAxis)
    .enter();

  temperatureLabel
    .append("rect")
    .attr("x", d => xScale(d.index, d.temp) - textPadding.dx)
    .attr("y", d => yScale(d.index, d.temp) - textPadding.dy)
    .attr("WIDTH", 2 * textPadding.dx)
    .attr("HEIGHT", 2 * textPadding.dy)
    .style("fill", "#fff");

  temperatureLabel
    .append("text")
    .attr("x", d => xScale(d.index, d.temp))
    .attr("y", d => yScale(d.index, d.temp))
    .text(d => d.temp + "°C")
    .attr("class", "temperature")
    .style("font-size", 0.013 * HEIGHT);

  //temperature and precipitation

  //this year's temperature
  const thisYear = json.DATA.filter(d => d.min);

  drawRadial(viewport, "year", thisYear, "min", "max");

  //title
  svg
    .append("text")
    .attr("x", WIDTH / 2)
    .attr("y", HEIGHT / 2)
    .text(json.STATION.NAME)
    .attr("class", "title")
    .style("font-size", 0.036 * HEIGHT);

  // geolocation
  const geolocation =
    (json.STATION.LONGITUDE > 0
      ? `${json.STATION.LONGITUDE.toFixed(4)}° E`
      : `${-json.STATION.LONGITUDE.toFixed(4)}° W`) +
    "  " +
    (json.STATION.LATITUDE > 0
      ? `${json.STATION.LATITUDE.toFixed(4)}° N`
      : `${-json.STATION.LATITUDE.toFixed(4)}° S`) +
    "  " +
    `${json.STATION.ELEVATION}m`;
  svg
    .append("text")
    .attr("x", WIDTH - margin)
    .attr("y", HEIGHT - margin)
    .text(geolocation)
    .attr("class", "footnote")
    .style("font-size", 0.018 * HEIGHT);

  const code = json.STATION.CODE;
  svg
    .append("text")
    .attr("x", WIDTH - margin)
    .attr("y", HEIGHT - margin)
    .attr("dy", -margin)
    .text(code)
    .attr("class", "footnote")
    .style("font-size", 0.018 * HEIGHT);

  svg.attr("title", json.STATION.NAME);
});

Mousetrap.bind(["command+s", "ctrl+s"], function saveRadialAsSVG() {
  const domNode = document.getElementsByTagName("svg")[0];
  const fileName = d3.select(domNode).attr("title") + ".svg";
  saveAsSVG(domNode, fileName);
  return false;
});

/**
 * save as svg file given DOM node and fileName
 * @param domNode the DOM node that should be save as svg
 * @param fileName the expected file name saved to local filesystem
 */
const saveAsSVG = (domNode, fileName) => {
  const serializer = new XMLSerializer();
  const svgBlob = new Blob([serializer.serializeToString(domNode)], {
    type: "image/svg+xml"
  });
  saveAs(svgBlob, fileName);
};
