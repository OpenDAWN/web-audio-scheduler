"use strict";

let AudioContext = global.AudioContext || global.webkitAudioContext;

function defaults(value, defaultValue) {
  return value !== undefined ? value : defaultValue;
}

/**
 * @class WebAudioScheduler
 */
export default class WebAudioScheduler {
  /**
   * @constructor
   * @param {object} opts
   * @public
   */
  constructor(opts={}) {
    this.context = opts.context || new AudioContext();
    this.interval = +defaults(opts.interval, 0.025);
    this.aheadTime = +defaults(opts.aheadTime, 0.1);
    this.offsetTime = +defaults(opts.offsetTime, 0.005);
    this.timerAPI = defaults(opts.timerAPI, global);
    this.toSeconds = defaults(opts.toSeconds, (value)=> +value);
    this.playbackTime = 0;

    this._timerId = 0;
    this._schedId = 0;
    this._events = [];
  }

  /**
  * Current time of the audio context
  * @type {number}
  * @public
  */
  get currentTime() {
    return this.context.currentTime;
  }

  /**
   * Sorted list of scheduled items
   * @type {object[]}
   * @public
   */
  get events() {
    return this._events.slice();
  }

  /**
   * Start the scheduler timeline.
   * @param {function} callback
   * @return {WebAudioScheduler} self
   * @public
   */
  start(callback) {
    if (this._timerId === 0) {
      this._timerId = this.timerAPI.setInterval(()=> {
        let t0 = this.context.currentTime;
        let t1 = t0 + this.aheadTime;

        this._process(t0, t1);
      }, this.interval * 1000);
    }
    if (callback) {
      this.insert(0, callback);
    }
    return this;
  }

  /**
   * Stop the scheduler timeline.
   * @param {boolean} reset
   * @return {WebAudioScheduler} self
   * @public
   */
  stop(reset) {
    if (this._timerId !== 0) {
      this.timerAPI.clearInterval(this._timerId);
      this._timerId = 0;
    }
    if (reset) {
      this._events.splice(0);
    }
    return this;
  }

  /**
   * Insert the callback function into the scheduler timeline.
   * @param {number} time
   * @param {function(object)} callback
   * @param {*[]} args
   * @return {number} schedId
   * @public
   */
  insert(time, callback, args) {
    time = this.toSeconds(time, this);

    this._schedId += 1;

    let event = {
      id: this._schedId,
      time: time,
      callback: callback,
      args: args
    };
    let events = this._events;

    if (events.length === 0 || events[events.length - 1].time <= time) {
      events.push(event);
    } else {
      for (let i = 0, imax = events.length; i < imax; i++) {
        if (time < events[i].time) {
          events.splice(i, 0, event);
          break;
        }
      }
    }

    return event.id;
  }

  /**
   * Insert the callback function at next tick.
   * @param {function(object)} callback
   * @param {*[]} args
   * @return {number} schedId
   * @public
   */
  nextTick(callback, args) {
    return this.insert(this.playbackTime + this.aheadTime, callback, args);
  }

  /**
   * Remove the callback function from the scheduler timeline.
   * @param {number} schedId
   * @return {number} schedId
   * @public
   */
  remove(schedId) {
    let events = this._events;

    if (typeof schedId === "undefined") {
      events.splice(0);
    } else {
      for (let i = 0, imax = events.length; i < imax; i++) {
        if (schedId === events[i].id) {
          events.splice(i, 1);
          break;
        }
      }
    }

    return schedId;
  }

  /**
   * @private
   */
  _process(t0, t1) {
    let events = this._events;

    this.playbackTime = t0;

    while (events.length && events[0].time < t1) {
      let event = events.shift();

      this.playbackTime = Math.max(this.context.currentTime, event.time) + this.offsetTime;

      event.callback.apply(this, [ {
        target: this,
        playbackTime: this.playbackTime
      } ].concat(event.args));
    }

    this.playbackTime = t0;
  }
}
