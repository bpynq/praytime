(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PrayTime = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;

  const sin = (d) => Math.sin(d * DEG);
  const cos = (d) => Math.cos(d * DEG);
  const tan = (d) => Math.tan(d * DEG);
  const arcsin = (d) => Math.asin(d) * RAD;
  const arccos = (d) => Math.acos(d) * RAD;
  const arccot = (x) => Math.atan(1 / x) * RAD;
  const arctan2 = (y, x) => Math.atan2(y, x) * RAD;
  const mod = (a, b) => ((a % b) + b) % b;

  class PrayTime {
    constructor(lat = 0, lng = 0) {
      this.fajrAngle = 18;
      this.ishaAngle = 18;
      this.lat = lat;
      this.lng = lng;
    }

    times(date = new Date()) {
      const [year, month, day] = Array.isArray(date)
        ? date
        : [date.getFullYear(), date.getMonth() + 1, date.getDate()];

      this.utcTime = Date.UTC(year, month - 1, day);
      const rawTimes = this.computeTimes();
      const result = {};

      for (const key in rawTimes) {
        const timestamp = this.utcTime + Math.floor((rawTimes[key] - this.lng / 15) * 36e5);
        result[key] = Math.floor(timestamp / 60000) * 60000;
      }

      return result;
    }

    computeTimes() {
      const horizon = 0.833;
      return {
        fajr: this.angleTime(this.fajrAngle, 5, -1),
        sunrise: this.angleTime(horizon, 6, -1),
        dhuhr: this.midDay(12),
        asr: this.angleTime(this.asrAngle('Standard'), 13),
        asrHanafi: this.angleTime(this.asrAngle('Hanafi'), 13),
        sunset: this.angleTime(horizon, 18),
        isha: this.angleTime(this.ishaAngle, 18),
        midnight: this.midDay(24) + 12
      };
    }

    sunPosition(time) {
      const D = this.utcTime / 864e5 - 10957.5 + time / 24 - this.lng / 360;
      const g = mod(357.529 + 0.98560028 * D, 360);
      const q = mod(280.459 + 0.98564736 * D, 360);
      const L = mod(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
      const e = 23.439 - 0.00000036 * D;
      const RA = mod(arctan2(cos(e) * sin(L), cos(L)) / 15, 24);

      return {
        declination: arcsin(sin(e) * sin(L)),
        equation: q / 15 - RA
      };
    }

    midDay(time) {
      const eqt = this.sunPosition(time).equation;
      return mod(12 - eqt, 24);
    }

    angleTime(angle, time, direction = 1) {
      const decl = this.sunPosition(time).declination;
      const num = -sin(angle) - sin(this.lat) * sin(decl);
      const diff = arccos(num / (cos(this.lat) * cos(decl))) / 15;
      return this.midDay(time) + diff * direction;
    }

    asrAngle(asrParam) {
      const shadowFactor = asrParam === 'Hanafi' ? 2 : 1;
      const decl = this.sunPosition(13).declination;
      return -arccot(shadowFactor + tan(Math.abs(this.lat - decl)));
    }
  }

  function formatTime(timestamp, timeZone) {
    return new Date(timestamp).toLocaleTimeString('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });
  }

  function formatDate(date, timeZone) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
        .formatToParts(date)
        .map((part) => [part.type, part.value])
    );
    return `${parts.day} ${parts.month} ${parts.year}`;
  }

  function getDateParts(date, timeZone) {
    const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
      .format(date)
      .split('-')
      .map(Number);
    return { year, month, day };
  }

  function calcQiyam(sunsetTs, nextFajrTs) {
    return Math.floor((sunsetTs + (2 / 3) * (nextFajrTs - sunsetTs)) / 60000) * 60000;
  }

  function getDailyPrayerData(location, refDate) {
    const date = refDate ? new Date(refDate) : new Date();
    const tz = location.timezone;

    const pt = new PrayTime(location.lat, location.lng);
    const { year, month, day } = getDateParts(date, tz);

    const prevDate = new Date(Date.UTC(year, month - 1, day - 1));
    const nextDate = new Date(Date.UTC(year, month - 1, day + 1));

    const yestTimes = pt.times([prevDate.getUTCFullYear(), prevDate.getUTCMonth() + 1, prevDate.getUTCDate()]);
    const todayTimes = pt.times([year, month, day]);
    const tomTimes = pt.times([nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, nextDate.getUTCDate()]);

    const yestQiyamTs = calcQiyam(yestTimes.sunset, todayTimes.fajr);
    const todayQiyamTs = calcQiyam(todayTimes.sunset, tomTimes.fajr);

    return {
      location,
      date,
      dateFormatted: formatDate(date, tz),
      fajr: {
        today: formatTime(todayTimes.fajr, tz),
        tomorrow: formatTime(tomTimes.fajr, tz),
        todayTs: todayTimes.fajr,
        tomorrowTs: tomTimes.fajr
      },
      sunrise: {
        today: formatTime(todayTimes.sunrise, tz),
        tomorrow: formatTime(tomTimes.sunrise, tz),
        todayTs: todayTimes.sunrise,
        tomorrowTs: tomTimes.sunrise
      },
      dhuhr: {
        today: formatTime(todayTimes.dhuhr, tz),
        todayTs: todayTimes.dhuhr
      },
      asr: {
        standard: formatTime(todayTimes.asr, tz),
        hanafi: formatTime(todayTimes.asrHanafi, tz),
        standardTs: todayTimes.asr,
        hanafiTs: todayTimes.asrHanafi
      },
      sunset: {
        today: formatTime(todayTimes.sunset, tz),
        todayTs: todayTimes.sunset
      },
      isha: {
        today: formatTime(todayTimes.isha, tz),
        todayTs: todayTimes.isha
      },
      midnight: {
        yesterday: formatTime(yestTimes.midnight, tz),
        today: formatTime(todayTimes.midnight, tz),
        yesterdayTs: yestTimes.midnight,
        todayTs: todayTimes.midnight
      },
      qiyam: {
        yesterday: formatTime(yestQiyamTs, tz),
        today: formatTime(todayQiyamTs, tz),
        yesterdayTs: yestQiyamTs,
        todayTs: todayQiyamTs
      }
    };
  }

  PrayTime.formatTime = formatTime;
  PrayTime.formatDate = formatDate;
  PrayTime.calcQiyam = calcQiyam;
  PrayTime.getDailyPrayerData = getDailyPrayerData;

  return PrayTime;
});
