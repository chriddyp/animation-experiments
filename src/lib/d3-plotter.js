'use strict';

var d3 = require('plotly.js').d3;

module.exports = Plotter;

function Plotter () {
  if (!(this instanceof Plotter)) return new Plotter();

  var plotter = {
    margin: {
      top: 100,
      right: 80,
      bottom: 80,
      left: 80
    },

    bounds: {
      x: [-40, 40],
      y: [-40, 40],
    },

    config: {},

    setSize: function (w, h) {
      this.svg.attr('width', w)
      this.svg.attr('height', h);

      this.width = w - this.margin.right - this.margin.left;
      this.height = h - this.margin.top - this.margin.bottom;

      return this;
    },

    applyAspectRatio: function () {
      if (this.config.xaxis.aspectRatio) {
        var yd = this.yScale.domain();
        var xd = this.xScale.domain();
        var dy = 0.5 * (yd[1] - yd[0]);
        var cy = 0.5 * (yd[1] + yd[0]);
        var dx = 0.5 * (xd[1] - xd[0]);
        var cx = 0.5 * (xd[1] + xd[0]);

        this.bounds.x[0] = cx - dy * this.width / this.height * this.config.xaxis.aspectRatio
        this.bounds.x[1] = cx + dy * this.width / this.height * this.config.xaxis.aspectRatio

        this.xScale.domain(this.bounds.x)
      }
      if (this.config.yaxis.aspectRatio) {
        var yd = this.yScale.domain();
        var xd = this.xScale.domain();
        var dy = 0.5 * (yd[1] - yd[0]);
        var cy = 0.5 * (yd[1] + yd[0]);
        var dx = 0.5 * (xd[1] - xd[0]);
        var cx = 0.5 * (xd[1] + xd[0]);

        this.bounds.y[0] = cy - dx * this.height / this.width * this.config.yaxis.aspectRatio
        this.bounds.y[1] = cy + dx * this.height / this.width * this.config.yaxis.aspectRatio

        this.yScale.domain(this.bounds.y)
      }
    },

    onResize: function () {
      this.setSize(window.innerWidth, window.innerHeight);

      this.applyAspectRatio();

      this.createScales();
      this.updateAxes();
      this.updateTraces();

      return this;
    },

    setConfig: function (opts) {
      opts = opts || {}

      this.bounds.x = opts.xaxis.bounds;
      this.bounds.y = opts.yaxis.bounds;
      this.config.xaxis = opts.xaxis;
      this.config.yaxis = opts.yaxis;

      return this;
    },

    initialize: function (opts) {
      this.setConfig(opts)

      this.svg = d3.select('body').append('svg')
      this.setSize(window.innerWidth, window.innerHeight);

      // Graph root:
      this.graphRoot = this.svg.append('g')
          .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
          .attr('class', 'graphRoot');

      this.createScales();
      this.createAxes();
      this.applyAspectRatio();
      this.updateAxes();

      // Window resizing:
      window.addEventListener('resize', this.onResize.bind(this));

      this.traces = [];
      this.frameCallbacks = [];
      this.frameCounter = 0;

      return this;
    },

    add: function (opts) {
      this.traces.push(this.createTrace(opts));
      return this;
    },

    createScales: function () {
      this.xScale = d3.scale.linear().domain(this.bounds.x).range([0, this.width]);
      this.yScale = d3.scale.linear().domain(this.bounds.y).range([this.height, 0]);

      return this;
    },

    updateAxes: function () {
      this.xAxis = d3.svg.axis().orient('bottom').scale(this.xScale).ticks(11, d3.format(',d'));
      this.yAxis = d3.svg.axis().orient('left').scale(this.yScale).ticks(11, d3.format(',d'));

      this.gXAxis.call(this.xAxis);
      this.gYAxis.call(this.yAxis);

      var yAt = this.config.yaxis.at === undefined ? 0 : this.config.yaxis.at;
      var xAt = this.config.xaxis.at === undefined ? 0 : this.config.xaxis.at;
      yAt = Math.min(Math.max(yAt, this.bounds.x[0]), this.bounds.x[1]);
      xAt = Math.min(Math.max(xAt, this.bounds.y[0]), this.bounds.y[1]);

      this.gXAxis
          .attr('transform', 'translate(0,' + Math.max(0, Math.min(this.height, this.yScale(xAt))) + ')')

      this.gYAxis
          .attr('transform', 'translate(' + Math.max(0, Math.min(this.width, this.xScale(yAt))) + ',0)')

      return this;
    },

    createAxes: function () {
      this.gXAxis = this.graphRoot.append('g')
          .attr('class', 'x axis')

      this.gYAxis = this.graphRoot.append('g')
          .attr('class', 'y axis')

      this.updateAxes();

      return this;
    },

    createTrace: function (opts) {
      var self = this;
      opts = opts || {};

      var getX = opts.getX;
      var getY = opts.getY;
      var x = opts.x;
      var y = opts.y;
      var data = opts.data;

      if (opts.getX && opts.getY) {
        var transformAccessor = function (d, i) {
          return 'translate(' + self.xScale(getX(i)) + ',' + self.yScale(getY(i)) + ')';
        }.bind(this);
      } else if (opts.getX) {
        var transformAccessor = function (d, i) {
          return 'translate(' + self.xScale(getX(i)) + ',' + self.yScale(y[i]) + ')';
        }.bind(this);
      } else if (opts.getY) {
        var transformAccessor = function (d, i) {
          return 'translate(' + self.xScale(x[i]) + ',' + self.yScale(getY(i)) + ')';
        }.bind(this);
      } else {
        var transformAccessor = function (d, i) {
          return 'translate(' + self.xScale(x[i]) + ',' + self.yScale(y[i]) + ')';
        }.bind(this);
      }

      var xAccessor = function (d, i) { return self.xScale(x[i]) }
      var yAccessor = function (d, i) { return self.yScale(y[i]) }

      var makeline = d3.svg.line().x(xAccessor).y(yAccessor);

      var trace = {
        initialize: function () {
          this.plot = self.graphRoot.append('g')
              .attr('class', 'trace')

          this.tracePoints = this.plot.append('g')
              .attr('class', 'points');

          this.traceLines = this.plot.append('g')
              .attr('class', 'lines');

          this.points = this.tracePoints.selectAll('circle')
              .data(data)

          this.traceLines.selectAll('path').data([data]).enter()
              .append('path')
                  .attr('d', function (d) {
                    return makeline(d);
                  })
                  .style('fill', 'none')
                  .style('stroke', '#aaa');

          this.points.enter().append('circle')
              .attr('r', 3)
              .attr('transform', transformAccessor)
              //.attr('cx', xAccessor)
              //.attr('cy', yAccessor)
        },

        updateData: function (newData, newX, newY, duration) {
          duration = duration === undefined ? 250 : duration;

          x = newX;
          y = newY;
          data = newData;

          this.points = this.tracePoints.selectAll('circle')
              .data(data)

          this.points.enter().append('circle')
              .attr('opacity', 0)
              .transition()
                  .duration(duration)
                  .attr('opacity', 1)

          this.points.exit()
              .transition()
                  .duration(duration)
                  .style('opacity', 0)
                  .remove();

          this.points
              .attr('r', 3)
              .attr('transform', transformAccessor)
              //.attr('cx', xAccessor)
              //.attr('cy', yAccessor)

          //join.enter().append('circle')
              //.attr('r', 1.5)
              //.attr('transform', transformAccessor)

          //join.exit().remove();
          this.traceLines.selectAll('path').data([data])
              .transition()
                  .duration(duration)
                  .attr('d', makeline(data))

        },

        update: function (duration) {
          //this.line.attr('d', makeline(data))

          this.points.data(data)
              .attr('transform', transformAccessor)
              //.attr('cx', xAccessor)
              //.attr('cy', yAccessor)
        },
      };

      trace.initialize();

      return trace;
    },

    updateData: function (i, data, x, y, duration) {
      this.traces[i].updateData(data, x, y, duration);
    },

    updateTraces: function (duration) {
      for (var i = 0; i < this.traces.length; i++) {
        var trace = this.traces[i];
        trace.update(duration);
      }
      return this;
    },

    destroy: function () {
      this.svg.remove();
    }
  };

  return plotter;
}
