const city = `${location.hash.substring(1)}`;
const year = 2016;
const margin = 20,
  WIDTH = Math.min(window.innerWidth, 1.3 * window.innerHeight) - margin,
  HEIGHT = window.innerHeight - margin,
  LOWEST = -40,
  HIGHEST = 60,
  maxPRCPRadius = WIDTH / 16;
const ANIMATION = {
  durationPerDay: 7.5 // unit: ms
};
const svg = d3.select("svg").attr("width", WIDTH).attr("height", HEIGHT);
// remove body unresolved when WIDTH and HEIGHT is setup
d3.select("#app").attr("unresolved", null);

const viewport = svg
  .append("g")
  .attr("class", "viewport")
  .attr("transform", "translate(" + [WIDTH / 2, HEIGHT / 2] + ")");
const rScale = d3
  .scaleLinear()
  .domain([LOWEST, HIGHEST])
  .range([0, HEIGHT / 2 - margin]);
const yScale = (day, temp) =>
  -Math.cos(angleScale(day) * Math.PI / 180) * rScale(parseInt(temp));
const xScale = (day, temp) =>
  Math.sin(angleScale(day) * Math.PI / 180) * rScale(parseInt(temp));
const angleScale = d3.scaleLinear().range([0, 360]);
const prcpScale = d3.scaleLinear().range([0, maxPRCPRadius]);

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
    .attr("x", xScale(0, HIGHEST - 12))
    .attr("y", yScale(0, HIGHEST - 12))
    .attr("dx", ".25em")
    .attr("transform", d => {
      return `rotate(${angleScale(d.index)})`;
    })
    .text(d => d.month)
    .attr("class", "months")
    .style("font-size", 0.013 * HEIGHT);
};

const formatLongitude = longitude => {
  if (longitude === 0) {
    return "0°";
  } else if (longitude > 0) {
    return `${longitude.toFixed(4)}° E`;
  }
  return `${-longitude.toFixed(4)}° W`;
};

const formatLatitude = latitude => {
  if (latitude === 0) {
    return "0°";
  } else if (latitude > 0) {
    return `${latitude.toFixed(4)}° N`;
  }
  return `${-latitude.toFixed(4)}° S`;
};

const formatElevation = elevation => `${elevation}m`;

const d3Preprocess = json => {
  const months = [];
  //find index for months based on data
  json.DATA.forEach((d, i) => {
    const day = moment(d.date, "YYYYMMDD");
    if (i === 0 || !moment(json.DATA[i - 1].date).isSame(day, "month")) {
      months.push({
        month: day.format("MMM").toUpperCase(),
        index: i
      });
    }
  });
  Object.assign(json.STATION, {
    geolocationDisplay: [
      formatLatitude(json.STATION.LATITUDE),
      formatLongitude(json.STATION.LONGITUDE),
      formatElevation(json.STATION.ELEVATION)
    ].join(" ")
  });
  return Object.assign({}, json, {
    months
  });
};

const processNA = NA => data => {
  if (data === NA) {
    return null;
  }
  return data;
};

const skipNull = fn => data => {
  if (data === null) {
    return null;
  }
  return fn(data);
};
const toCelcius = fr => +((fr - 32) * 5 / 9).toFixed(1);
const toMM = inch => +(inch * 25.4).toFixed(1);

const gsodPreprocess = (raw, cityData) => {
  const lines = raw.split("\n");
  lines.shift();
  return {
    DATA: lines.filter(line => line !== "").map(line => {
      const date = line.substring(14, 22);
      const tmin = skipNull(toCelcius)(
        processNA(9999.9)(parseFloat(line.substring(110, 115).replace("*", "")))
      );
      const tmax = skipNull(toCelcius)(
        processNA(9999.9)(parseFloat(line.substring(102, 107).replace("*", "")))
      );
      const prcp = skipNull(toMM)(
        processNA(99.99)(
          parseFloat(line.substring(118, 122).replace(/A-Z/, ""))
        )
      );
      return { date, tmin, tmax, prcp };
    }),
    STATION: {
      LATITUDE: cityData.latitude,
      LONGITUDE: cityData.longitude,
      ELEVATION: cityData.elevation,
      NAME: cityData.name
    }
  };
};
let cityData = { latitude: 0.0, longitude: 0.0, elevation: 0.0, name: "" };

fetch(`https://days.ml/city/${city}`)
  .then(response => response.json())
  .then(cityDatum => {
    if (cityDatum.length === 0) {
      throw new Error("No corresponding city");
    }
    cityData = cityDatum.shift();
    const station = cityData.stations.shift();
    return fetch(`https://days.ml/data/${station.id}-${year}.op`);
  })
  .then(r => r.text())
  .then(raw => {
    const json = d3Preprocess(gsodPreprocess(raw, cityData));
    const days = json.DATA.length;
    angleScale.domain([0, days - 1]);
    const maxPRCP = d3.max(json.DATA, d => d.prcp);
    prcpScale.domain([0, maxPRCP]);

    // define gradients
    svg
      .append("defs")
      .append("radialGradient")
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", rScale(HIGHEST - 20))
      .attr("id", "heatGradient")
      .call(generateRadialGradient);

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
    viewport
      .append("g")
      .attr("class", "axis-container")
      .selectAll(".axis")
      .data(json.months)
      .enter()
      .call(renderAxis);

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
      .attr("width", 2 * textPadding.dx)
      .attr("height", 2 * textPadding.dy)
      .style("fill", "#fff");

    temperatureLabel
      .append("text")
      .attr("x", d => xScale(d.index, d.temp))
      .attr("y", d => yScale(d.index, d.temp))
      .text(d => d.temp + "°C")
      .attr("class", "temperature-label")
      .style("font-size", 0.013 * HEIGHT);

    //temperature and precipitation

    viewport
      .append("g")
      .attr("class", "precipitation-container")
      .selectAll(".precipitation")
      .data(json.DATA)
      .enter()
      .append("circle")
      .attr("class", "precipitation")
      .attr("cx", (d, i) => xScale(i, (d.tmin + d.tmax) / 2))
      .attr("cy", (d, i) => yScale(i, (d.tmin + d.tmax) / 2))
      .style("opacity", 0)
      .transition()
      .duration(300)
      .ease(d3.easeBackOut)
      .delay((d, i) => i * ANIMATION.durationPerDay)
      .style("opacity", 1)
      .attr("r", d => prcpScale(d.prcp));

    viewport
      .append("g")
      .attr("class", "temperature-container")
      .selectAll(".temperature")
      .data(json.DATA)
      .enter()
      .append("line")
      .attr("x1", (d, i) => xScale(i, (d.tmin + d.tmax) / 2))
      .attr("x2", (d, i) => xScale(i, (d.tmin + d.tmax) / 2))
      .attr("y1", (d, i) => yScale(i, (d.tmin + d.tmax) / 2))
      .attr("y2", (d, i) => yScale(i, (d.tmin + d.tmax) / 2))
      .attr("class", "temperature")
      .style("stroke", "url(#heatGradient)")
      .transition()
      .duration(300)
      .delay((d, i) => i * ANIMATION.durationPerDay)
      .attr("x1", (d, i) => xScale(i, d.tmin))
      .attr("x2", (d, i) => xScale(i, d.tmax))
      .attr("y1", (d, i) => yScale(i, d.tmin))
      .attr("y2", (d, i) => yScale(i, d.tmax));

    //title
    viewport
      .append("text")
      .attr("x", 0)
      .attr("y", 0)
      .text(json.STATION.NAME)
      .attr("class", "title")
      .style("font-size", 0.036 * HEIGHT);

    // geolocation and station name
    const footnotes = [json.STATION.CODE, json.STATION.geolocationDisplay];
    viewport
      .append("g")
      .attr("class", "legend-container")
      .selectAll(".footnote")
      .data(footnotes)
      .enter()
      .append("text")
      .attr("x", WIDTH / 2 - margin)
      .attr("y", HEIGHT / 2 - margin)
      .text(d => d)
      .attr("dy", (_, i) => -(footnotes.length - 1 - i) * margin)
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
