import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI } from '../services/api';
import './Admin.css';

const Admin = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('daily');
  const [employees, setEmployees] = useState([]);
  const [dailyReport, setDailyReport] = useState(null);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [punches, setPunches] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [editingPunch, setEditingPunch] = useState(null);
  const [editForm, setEditForm] = useState({ punchIn: '', punchOut: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'daily') {
        const res = await adminAPI.getDailyReport(selectedDate);
        setDailyReport(res.data);
      } else if (activeTab === 'weekly') {
        const res = await adminAPI.getWeeklyReport();
        setWeeklyReport(res.data);
      } else if (activeTab === 'punches') {
        const [punchRes, empRes] = await Promise.all([
          adminAPI.getPunches({ date: selectedDate }),
          adminAPI.getEmployees(),
        ]);
        setPunches(punchRes.data.punches || []);
        setEmployees(empRes.data.employees || []);
      } else if (activeTab === 'employees') {
        const res = await adminAPI.getEmployees();
        setEmployees(res.data.employees || []);
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedDate]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, fetchData]);

  const handleEditPunch = (punch) => {
    setEditingPunch(punch);
    setEditForm({
      punchIn: punch.punchIn ? punch.punchIn.slice(0, 16) : '',
      punchOut: punch.punchOut ? punch.punchOut.slice(0, 16) : '',
    });
  };

  const handleSaveEdit = async () => {
    try {
      await adminAPI.editPunch(editingPunch.id, {
        punchIn: editForm.punchIn ? new Date(editForm.punchIn).toISOString() : undefined,
        punchOut: editForm.punchOut ? new Date(editForm.punchOut).toISOString() : undefined,
      });
      setEditingPunch(null);
      fetchData();
    } catch (err) {
      console.error('Edit error:', err);
      alert('Failed to save changes');
    }
  };

  const handleDeletePunch = async (punchId) => {
    if (window.confirm('Are you sure you want to delete this punch record?')) {
      try {
        await adminAPI.deletePunch(punchId);
        fetchData();
      } catch (err) {
        console.error('Delete error:', err);
        alert('Failed to delete punch');
      }
    }
  };

  const formatHours = (hoursObj) => {
    if (!hoursObj) return '0h 0m';
    return `${hoursObj.hours}h ${hoursObj.minutes}m`;
  };

  const formatMinutes = (minutes) => {
    if (!minutes && minutes !== 0) return '-';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  };

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You don&apos;t have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h1>Admin Dashboard</h1>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          Daily Report
        </button>
        <button
          className={`tab ${activeTab === 'weekly' ? 'active' : ''}`}
          onClick={() => setActiveTab('weekly')}
        >
          Weekly Report
        </button>
        <button
          className={`tab ${activeTab === 'punches' ? 'active' : ''}`}
          onClick={() => setActiveTab('punches')}
        >
          Manage Punches
        </button>
        <button
          className={`tab ${activeTab === 'employees' ? 'active' : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          Employees
        </button>
      </div>

      {/* Date Selector */}
      {(activeTab === 'daily' || activeTab === 'punches') && (
        <div className="date-selector">
          <label>Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      ) : (
        <>
          {/* Daily Report */}
          {activeTab === 'daily' && dailyReport && (
            <div className="report-section">
              <h2>Daily Report - {dailyReport.date}</h2>
              
              {/* Totals Summary */}
              <div className="totals-card">
                <h3>Summary</h3>
                <div className="totals-grid">
                  <div className="total-item">
                    <span className="label">Total Employees</span>
                    <span className="value">{dailyReport.totals?.totalEmployees || 0}</span>
                  </div>
                  <div className="total-item">
                    <span className="label">Total Hours</span>
                    <span className="value">{formatMinutes(dailyReport.totals?.totalWorkedMinutes)}</span>
                  </div>
                  <div className="total-item">
                    <span className="label">Overtime</span>
                    <span className="value highlight">{formatMinutes(dailyReport.totals?.overtimeMinutes)}</span>
                  </div>
                  <div className="total-item">
                    <span className="label">Late Minutes</span>
                    <span className="value warning">{formatMinutes(dailyReport.totals?.lateMinutes)}</span>
                  </div>
                </div>
              </div>

              {/* Employee Table */}
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Schedule</th>
                      <th>Total</th>
                      <th>Regular</th>
                      <th>OT</th>
                      <th>ND</th>
                      <th>Late</th>
                      <th>Undertime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyReport.employeeSummaries?.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="no-data">No records for this date</td>
                      </tr>
                    ) : (
                      dailyReport.employeeSummaries?.map((summary, idx) => (
                        <tr key={idx}>
                          <td>
                            <div className="employee-info">
                              <span className="name">{summary.userName}</span>
                              <span className="email">{summary.userEmail}</span>
                            </div>
                          </td>
                          <td>{summary.schedule?.start} - {summary.schedule?.end}</td>
                          <td>{formatHours(summary.totalWorked)}</td>
                          <td>{formatHours(summary.regular)}</td>
                          <td className="highlight">{formatHours(summary.overtime)}</td>
                          <td>{formatHours(summary.nightDifferential)}</td>
                          <td className="warning">{formatHours(summary.late)}</td>
                          <td className="warning">{formatHours(summary.undertime)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Weekly Report */}
          {activeTab === 'weekly' && weeklyReport && (
            <div className="report-section">
              <h2>Weekly Report</h2>
              <p className="date-range">{weeklyReport.startDate} to {weeklyReport.endDate}</p>
              
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Days Worked</th>
                      <th>Total Hours</th>
                      <th>Regular</th>
                      <th>OT</th>
                      <th>ND</th>
                      <th>Late</th>
                      <th>Undertime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyReport.employeeReports?.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="no-data">No records for this week</td>
                      </tr>
                    ) : (
                      weeklyReport.employeeReports?.map((report, idx) => (
                        <tr key={idx}>
                          <td>
                            <div className="employee-info">
                              <span className="name">{report.userName}</span>
                              <span className="email">{report.userEmail}</span>
                            </div>
                          </td>
                          <td>{report.daysWorked}</td>
                          <td>{formatHours(report.weeklyTotals?.totalWorked)}</td>
                          <td>{formatHours(report.weeklyTotals?.regular)}</td>
                          <td className="highlight">{formatHours(report.weeklyTotals?.overtime)}</td>
                          <td>{formatHours(report.weeklyTotals?.nightDifferential)}</td>
                          <td className="warning">{formatHours(report.weeklyTotals?.late)}</td>
                          <td className="warning">{formatHours(report.weeklyTotals?.undertime)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Manage Punches */}
          {activeTab === 'punches' && (
            <div className="report-section">
              <h2>Manage Punches - {selectedDate}</h2>
              
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Punch In</th>
                      <th>Punch Out</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {punches.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="no-data">No punches for this date</td>
                      </tr>
                    ) : (
                      punches.map((punch) => (
                        <tr key={punch.id}>
                          <td>
                            <div className="employee-info">
                              <span className="name">{punch.userName}</span>
                            </div>
                          </td>
                          <td>{punch.punchIn ? new Date(punch.punchIn).toLocaleTimeString() : '-'}</td>
                          <td>{punch.punchOut ? new Date(punch.punchOut).toLocaleTimeString() : '-'}</td>
                          <td>
                            <span className={`status-badge ${punch.status}`}>
                              {punch.status}
                            </span>
                          </td>
                          <td>{formatHours(punch.metrics?.totalWorked)}</td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="btn-edit"
                                onClick={() => handleEditPunch(punch)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn-delete"
                                onClick={() => handleDeletePunch(punch.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Employees List */}
          {activeTab === 'employees' && (
            <div className="report-section">
              <h2>All Employees</h2>
              
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Schedule</th>
                      <th>Timezone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="no-data">No employees found</td>
                      </tr>
                    ) : (
                      employees.map((emp) => (
                        <tr key={emp.uid}>
                          <td>{emp.name}</td>
                          <td>{emp.email}</td>
                          <td>
                            <span className={`role-badge ${emp.role}`}>
                              {emp.role}
                            </span>
                          </td>
                          <td>{emp.schedule?.start} - {emp.schedule?.end}</td>
                          <td>{emp.timezone}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      {editingPunch && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Edit Punch Record</h3>
            <div className="modal-content">
              <div className="form-group">
                <label>Punch In</label>
                <input
                  type="datetime-local"
                  value={editForm.punchIn}
                  onChange={(e) => setEditForm({ ...editForm, punchIn: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Punch Out</label>
                <input
                  type="datetime-local"
                  value={editForm.punchOut}
                  onChange={(e) => setEditForm({ ...editForm, punchOut: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setEditingPunch(null)}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleSaveEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
