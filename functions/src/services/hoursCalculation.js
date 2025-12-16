/**
 * Hours Calculation Service
 * Computes regular hours, overtime, night differential, lateness, and undertime
 */

/**
 * Parse time string (HH:MM) to minutes since midnight
 * @param {string} timeStr - Time string in HH:MM format
 * @returns {number} Minutes since midnight
 */
const parseTimeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Convert minutes to hours and minutes object
 * @param {number} totalMinutes - Total minutes
 * @returns {object} Object with hours and minutes
 */
const minutesToHoursObj = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes, totalMinutes };
};

/**
 * Calculate night differential minutes
 * Night differential is work between 22:00 (10 PM) and 06:00 (6 AM)
 * @param {Date} punchIn - Punch in timestamp
 * @param {Date} punchOut - Punch out timestamp
 * @returns {number} Night differential minutes
 */
const calculateNightDifferential = (punchIn, punchOut) => {
  let ndMinutes = 0;
  
  // Create date objects for ND start (22:00) and end (06:00)
  const inDate = new Date(punchIn);
  const outDate = new Date(punchOut);
  
  // Calculate for each minute of work (simplified approach)
  let current = new Date(inDate);
  
  while (current < outDate) {
    const hour = current.getHours();
    // Night differential: 22:00 - 06:00 (10 PM to 6 AM)
    if (hour >= 22 || hour < 6) {
      ndMinutes++;
    }
    current = new Date(current.getTime() + 60000); // Add 1 minute
  }
  
  return ndMinutes;
};

/**
 * Calculate all work metrics for a punch record
 * @param {Date} punchIn - Punch in timestamp
 * @param {Date} punchOut - Punch out timestamp
 * @param {object} schedule - User's schedule { start: 'HH:MM', end: 'HH:MM' }
 * @returns {object} Calculated metrics
 */
const calculateWorkMetrics = (punchIn, punchOut, schedule) => {
  const inDate = new Date(punchIn);
  const outDate = new Date(punchOut);
  
  // Total worked minutes
  const totalWorkedMinutes = Math.floor((outDate - inDate) / 60000);
  
  // Schedule in minutes
  const scheduleStartMinutes = parseTimeToMinutes(schedule.start);
  const scheduleEndMinutes = parseTimeToMinutes(schedule.end);
  const scheduledMinutes = scheduleEndMinutes - scheduleStartMinutes;
  
  // Actual punch times in minutes since midnight
  const punchInMinutes = inDate.getHours() * 60 + inDate.getMinutes();
  const punchOutMinutes = outDate.getHours() * 60 + outDate.getMinutes();
  
  // Calculate lateness (arrival after shift start)
  let lateMinutes = 0;
  if (punchInMinutes > scheduleStartMinutes) {
    lateMinutes = punchInMinutes - scheduleStartMinutes;
  }
  
  // Calculate undertime (leaving before shift end)
  let undertimeMinutes = 0;
  // Only calculate undertime if punch out is on the same day as the schedule
  if (punchOutMinutes < scheduleEndMinutes && outDate.getDate() === inDate.getDate()) {
    undertimeMinutes = scheduleEndMinutes - punchOutMinutes;
  }
  
  // Calculate regular hours (capped at scheduled hours minus late/undertime)
  let regularMinutes = Math.min(totalWorkedMinutes, scheduledMinutes);
  regularMinutes = Math.max(0, regularMinutes - lateMinutes);
  
  // Calculate overtime (work beyond scheduled hours)
  let overtimeMinutes = 0;
  if (totalWorkedMinutes > scheduledMinutes) {
    overtimeMinutes = totalWorkedMinutes - scheduledMinutes;
  }
  
  // Calculate night differential
  const nightDifferentialMinutes = calculateNightDifferential(inDate, outDate);
  
  return {
    totalWorked: minutesToHoursObj(totalWorkedMinutes),
    regular: minutesToHoursObj(regularMinutes),
    overtime: minutesToHoursObj(overtimeMinutes),
    nightDifferential: minutesToHoursObj(nightDifferentialMinutes),
    late: minutesToHoursObj(lateMinutes),
    undertime: minutesToHoursObj(undertimeMinutes),
    punchIn: inDate.toISOString(),
    punchOut: outDate.toISOString(),
  };
};

/**
 * Aggregate daily metrics from multiple punch records
 * @param {Array} punchRecords - Array of punch records with metrics
 * @returns {object} Aggregated daily totals
 */
const aggregateDailyMetrics = (punchRecords) => {
  const totals = {
    totalWorkedMinutes: 0,
    regularMinutes: 0,
    overtimeMinutes: 0,
    nightDifferentialMinutes: 0,
    lateMinutes: 0,
    undertimeMinutes: 0,
  };
  
  punchRecords.forEach(record => {
    totals.totalWorkedMinutes += record.totalWorked?.totalMinutes || 0;
    totals.regularMinutes += record.regular?.totalMinutes || 0;
    totals.overtimeMinutes += record.overtime?.totalMinutes || 0;
    totals.nightDifferentialMinutes += record.nightDifferential?.totalMinutes || 0;
    totals.lateMinutes += record.late?.totalMinutes || 0;
    totals.undertimeMinutes += record.undertime?.totalMinutes || 0;
  });
  
  return {
    totalWorked: minutesToHoursObj(totals.totalWorkedMinutes),
    regular: minutesToHoursObj(totals.regularMinutes),
    overtime: minutesToHoursObj(totals.overtimeMinutes),
    nightDifferential: minutesToHoursObj(totals.nightDifferentialMinutes),
    late: minutesToHoursObj(totals.lateMinutes),
    undertime: minutesToHoursObj(totals.undertimeMinutes),
    punchCount: punchRecords.length,
  };
};

/**
 * Format hours object to display string
 * @param {object} hoursObj - Object with hours and minutes
 * @returns {string} Formatted string like "2h 30m"
 */
const formatHours = (hoursObj) => {
  if (!hoursObj) return '0h 0m';
  return `${hoursObj.hours}h ${hoursObj.minutes}m`;
};

module.exports = {
  parseTimeToMinutes,
  minutesToHoursObj,
  calculateNightDifferential,
  calculateWorkMetrics,
  aggregateDailyMetrics,
  formatHours,
};
