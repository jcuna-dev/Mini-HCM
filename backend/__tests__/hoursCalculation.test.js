const {
  parseTimeToMinutes,
  minutesToHoursObj,
  calculateWorkMetrics,
  aggregateDailyMetrics,
  formatHours,
} = require('../src/services/hoursCalculation');

describe('Hours Calculation Service', () => {
  describe('parseTimeToMinutes', () => {
    it('should convert time string to minutes', () => {
      expect(parseTimeToMinutes('09:00')).toBe(540);
      expect(parseTimeToMinutes('18:00')).toBe(1080);
      expect(parseTimeToMinutes('00:00')).toBe(0);
      expect(parseTimeToMinutes('12:30')).toBe(750);
    });
  });

  describe('minutesToHoursObj', () => {
    it('should convert minutes to hours object', () => {
      expect(minutesToHoursObj(90)).toEqual({ hours: 1, minutes: 30, totalMinutes: 90 });
      expect(minutesToHoursObj(60)).toEqual({ hours: 1, minutes: 0, totalMinutes: 60 });
      expect(minutesToHoursObj(0)).toEqual({ hours: 0, minutes: 0, totalMinutes: 0 });
      expect(minutesToHoursObj(540)).toEqual({ hours: 9, minutes: 0, totalMinutes: 540 });
    });
  });

  describe('calculateWorkMetrics', () => {
    const schedule = { start: '09:00', end: '18:00' };

    it('should calculate regular hours for on-time punch', () => {
      // Punch in at 9:00 AM, punch out at 6:00 PM (9 hours)
      const punchIn = new Date('2024-01-15T09:00:00');
      const punchOut = new Date('2024-01-15T18:00:00');
      
      const metrics = calculateWorkMetrics(punchIn, punchOut, schedule);
      
      expect(metrics.totalWorked.hours).toBe(9);
      expect(metrics.regular.hours).toBe(9);
      expect(metrics.overtime.hours).toBe(0);
      expect(metrics.late.totalMinutes).toBe(0);
      expect(metrics.undertime.totalMinutes).toBe(0);
    });

    it('should calculate lateness', () => {
      // Punch in 30 minutes late at 9:30 AM
      const punchIn = new Date('2024-01-15T09:30:00');
      const punchOut = new Date('2024-01-15T18:00:00');
      
      const metrics = calculateWorkMetrics(punchIn, punchOut, schedule);
      
      expect(metrics.late.totalMinutes).toBe(30);
      expect(metrics.late.hours).toBe(0);
      expect(metrics.late.minutes).toBe(30);
    });

    it('should calculate undertime', () => {
      // Punch out 1 hour early at 5:00 PM
      const punchIn = new Date('2024-01-15T09:00:00');
      const punchOut = new Date('2024-01-15T17:00:00');
      
      const metrics = calculateWorkMetrics(punchIn, punchOut, schedule);
      
      expect(metrics.undertime.totalMinutes).toBe(60);
      expect(metrics.undertime.hours).toBe(1);
    });

    it('should calculate overtime', () => {
      // Work 2 hours extra, punch out at 8:00 PM
      const punchIn = new Date('2024-01-15T09:00:00');
      const punchOut = new Date('2024-01-15T20:00:00');
      
      const metrics = calculateWorkMetrics(punchIn, punchOut, schedule);
      
      expect(metrics.overtime.totalMinutes).toBe(120);
      expect(metrics.overtime.hours).toBe(2);
    });

    it('should calculate night differential', () => {
      // Work night shift 10 PM to 6 AM (8 hours)
      const punchIn = new Date('2024-01-15T22:00:00');
      const punchOut = new Date('2024-01-16T06:00:00');
      
      const nightSchedule = { start: '22:00', end: '06:00' };
      const metrics = calculateWorkMetrics(punchIn, punchOut, nightSchedule);
      
      // All 8 hours should be night differential
      expect(metrics.nightDifferential.hours).toBe(8);
    });
  });

  describe('aggregateDailyMetrics', () => {
    it('should aggregate multiple punch records', () => {
      const records = [
        {
          totalWorked: { hours: 4, minutes: 0, totalMinutes: 240 },
          regular: { hours: 4, minutes: 0, totalMinutes: 240 },
          overtime: { hours: 0, minutes: 0, totalMinutes: 0 },
          nightDifferential: { hours: 0, minutes: 0, totalMinutes: 0 },
          late: { hours: 0, minutes: 30, totalMinutes: 30 },
          undertime: { hours: 0, minutes: 0, totalMinutes: 0 },
        },
        {
          totalWorked: { hours: 5, minutes: 0, totalMinutes: 300 },
          regular: { hours: 4, minutes: 0, totalMinutes: 240 },
          overtime: { hours: 1, minutes: 0, totalMinutes: 60 },
          nightDifferential: { hours: 0, minutes: 0, totalMinutes: 0 },
          late: { hours: 0, minutes: 0, totalMinutes: 0 },
          undertime: { hours: 0, minutes: 0, totalMinutes: 0 },
        },
      ];

      const aggregated = aggregateDailyMetrics(records);

      expect(aggregated.totalWorked.hours).toBe(9);
      expect(aggregated.regular.hours).toBe(8);
      expect(aggregated.overtime.hours).toBe(1);
      expect(aggregated.late.totalMinutes).toBe(30);
      expect(aggregated.punchCount).toBe(2);
    });

    it('should return zeros for empty records', () => {
      const aggregated = aggregateDailyMetrics([]);

      expect(aggregated.totalWorked.totalMinutes).toBe(0);
      expect(aggregated.punchCount).toBe(0);
    });
  });

  describe('formatHours', () => {
    it('should format hours object to string', () => {
      expect(formatHours({ hours: 2, minutes: 30 })).toBe('2h 30m');
      expect(formatHours({ hours: 0, minutes: 0 })).toBe('0h 0m');
      expect(formatHours(null)).toBe('0h 0m');
    });
  });
});
