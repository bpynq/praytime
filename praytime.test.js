const test = require('node:test');
const assert = require('node:assert/strict');
const { getDailyPrayerData, calcQiyam, formatTime, formatDate } = require('./praytime.js');

const TEST_LOCATION = {
  name: 'TestCity',
  lat: 27.909788876867317,
  lng: 78.07253465945904,
  timezone: 'Asia/Kolkata'
};

test('getDailyPrayerData computes correct layout for a given location and date with floor rounding', () => {
  const date = new Date('2026-09-12T12:00:00+05:30');
  const data = getDailyPrayerData(TEST_LOCATION, date);

  assert.equal(data.dateFormatted, '12 Sep 2026');
  assert.deepEqual(
    {
      fajr: [data.fajr.today, data.fajr.tomorrow],
      sunrise: [data.sunrise.today, data.sunrise.tomorrow],
      dhuhr: [data.dhuhr.today],
      asr: [data.asr.standard, data.asr.hanafi],
      sunset: [data.sunset.today],
      isha: [data.isha.today],
      midnight: [data.midnight.yesterday, data.midnight.today],
      qiyam: [data.qiyam.yesterday, data.qiyam.today]
    },
    {
      fajr: ['04:42', '04:42'],
      sunrise: ['06:01', '06:01'],
      dhuhr: ['12:14'],
      asr: ['15:44', '16:41'],
      sunset: ['18:26'],
      isha: ['19:45'],
      midnight: ['00:14', '00:13'],
      qiyam: ['01:17', '01:16']
    }
  );
});

test('calcQiyam correctly calculates two-thirds of the night floored to minute', () => {
  const sunsetTs = Date.parse('2026-09-12T18:26:00+05:30');
  const nextFajrTs = Date.parse('2026-09-13T04:42:00+05:30');
  const qiyamTs = calcQiyam(sunsetTs, nextFajrTs);

  assert.equal(formatTime(qiyamTs, 'Asia/Kolkata'), '01:16');
});

test('formatDate and formatTime format values consistently', () => {
  const date = new Date('2026-09-12T15:30:45+05:30');

  assert.equal(formatTime(date.getTime(), 'Asia/Kolkata'), '15:30');
  assert.equal(formatDate(date, 'Asia/Kolkata'), '12 Sep 2026');
});
