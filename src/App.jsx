import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, query, onSnapshot, orderBy, Timestamp, writeBatch, doc, getDoc, setDoc } from 'firebase/firestore';
import * as LucideIcons from 'lucide-react';

// --- CONFIGURATION ---
// 1. Paste your Firebase Config here (from console.firebase.google.com)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID  
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const COLLECTIONS = {
  RESOURCES: 'resources',
  TIMESHEETS: 'timesheets',
  AGILE: 'agile_metrics',
  SLA: 'slas',
  FINANCIALS: 'financials',
  MILESTONES: 'milestones',
  USERS: 'users',
  AUDIT_LOGS: 'audit_logs',
  // Master Data Tables
  PROJECTS: 'projects',
  MASTER_RESOURCES: 'master_resources',
  SKILLS: 'skills',
  ORG_UNITS: 'organizational_units',
  ROLES: 'roles',
  LOCATIONS: 'locations',
  // Junction Tables
  RESOURCE_SKILLS: 'resource_skills',
  RESOURCE_PROJECTS: 'resource_projects',
  // RFC Tracking
  RFC_TRACKING: 'rfc_tracking',
  // Project Cost Estimation
  PROJECT_COST_ESTIMATION: 'project_cost_estimation',
  // Project Financials
  PROJECT_FINANCIALS: 'project_financials',
  DEFECT_DENSITY: 'defect_density',
  DEFECT_DETECTION_EFFICIENCY: 'defect_detection_efficiency'
};

// User Roles
const USER_ROLES = {
  DISPLAY_ONLY: 'display_only',
  PROJECT_MANAGER: 'project_manager',
  PROJECT_ADMIN: 'project_admin'
};

// --- COMPONENTS ---
const SearchableSelect = ({ 
  label, 
  value, 
  onChange, 
  options, 
  placeholder = "Search and select...", 
  required = false,
  displayFormat = (item) => item.id || item,
  searchFields = ['id', 'name'],
  valueKey = 'id'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredOptions(options);
    } else {
      const filtered = options.filter(option => {
        const searchValue = searchTerm.toLowerCase();
        return searchFields.some(field => {
          const fieldValue = typeof option === 'string' ? option : (option[field] || '');
          return fieldValue.toLowerCase().includes(searchValue);
        });
      });
      setFilteredOptions(filtered);
    }
  }, [searchTerm, options, searchFields]);

  const selectedOption = options.find(opt => (typeof opt === 'string' ? opt : opt[valueKey]) === value);
  const displayValue = selectedOption ? displayFormat(selectedOption) : '';

  return (
    <div style={{position: 'relative'}}>
      <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>{label}</label>
      <div 
        style={{
          width: '100%', 
          padding: '8px', 
          border: '1px solid #ccc', 
          borderRadius: '4px',
          backgroundColor: 'white',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{color: displayValue ? '#000' : '#999'}}>
          {displayValue || placeholder}
        </span>
        <span style={{fontSize: '12px'}}>▼</span>
      </div>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '4px',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: 'none',
              borderBottom: '1px solid #eee',
              outline: 'none',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          />
          {filteredOptions.length === 0 ? (
            <div style={{padding: '8px', color: '#999', textAlign: 'center'}}>
              No options found
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <div
                key={index}
                style={{
                  padding: '8px',
                  cursor: 'pointer',
                  borderBottom: index < filteredOptions.length - 1 ? '1px solid #eee' : 'none',
                  backgroundColor: 'white'
                }}
                onClick={() => {
                  const optionValue = typeof option === 'string' ? option : option[valueKey];
                  onChange(optionValue);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
              >
                {displayFormat(option)}
              </div>
            ))
          )}
        </div>
      )}
      
      {/* Hidden required input for form validation */}
      {required && (
        <input
          type="text"
          required
          value={value || ''}
          onChange={() => {}}
          style={{position: 'absolute', left: '-9999px', top: '-9999px'}}
        />
      )}
    </div>
  );
};

// Predefined Users for Local Authentication
const PREDEFINED_USERS = {
  display: {
    email: 'display@squadops.com',
    password: 'display77385',
    role: USER_ROLES.DISPLAY_ONLY,
    name: 'Display User'
  },
  manager: {
    email: 'manager@squadops.com',
    password: 'manager77385',
    role: USER_ROLES.PROJECT_MANAGER,
    name: 'Project Manager'
  },
  admin: {
    email: 'admin@squadops.com',
    password: 'admin77385',
    role: USER_ROLES.PROJECT_ADMIN,
    name: 'Project Admin'
  }
};

// Role Permissions
const ROLE_PERMISSIONS = {
  [USER_ROLES.DISPLAY_ONLY]: {
    canView: true,
    canAdd: false,
    canEdit: false,
    canDelete: false,
    canManageUsers: false
  },
  [USER_ROLES.PROJECT_MANAGER]: {
    canView: true,
    canAdd: true,
    canEdit: true,
    canDelete: false,
    canManageUsers: false
  },
  [USER_ROLES.PROJECT_ADMIN]: {
    canView: true,
    canAdd: true,
    canEdit: true,
    canDelete: true,
    canManageUsers: true
  }
};

// --- CSS STYLES (Your Provided Design) ---
const styles = `
    :root {
        --primary-color: #051c2c;
        --accent-color: #00a3e0;
        --bg-color: #f4f7f6;
        --card-bg: #ffffff;
        --text-color: #333333;
        --text-light: #666666;
        --border-color: #e0e0e0;
        
        --status-green: #2ecc71;
        --status-amber: #f1c40f;
        --status-red: #e74c3c;
    }

    .dashboard-container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 20px;
        font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: var(--text-color);
    }

    /* Header */
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 25px;
        background-color: var(--card-bg);
        padding: 20px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        border-left: 5px solid var(--primary-color);
    }

    .header h1 {
        margin: 0;
        font-size: 24px;
        color: var(--primary-color);
    }

    .header-meta {
        text-align: right;
        font-size: 14px;
        color: var(--text-light);
    }

    /* Executive Summary Section */
    .exec-summary {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 20px;
        margin-bottom: 20px;
    }

    .exec-card {
        background: var(--card-bg);
        padding: 20px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    .exec-title {
        font-weight: 700;
        text-transform: uppercase;
        font-size: 12px;
        color: var(--text-light);
        margin-bottom: 10px;
    }

    .exec-statement {
        font-size: 18px;
        font-weight: 600;
        color: var(--primary-color);
        line-height: 1.4;
    }

    .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
        color: white;
        margin-bottom: 10px;
    }
    .bg-green { background-color: var(--status-green); }
    .bg-amber { background-color: var(--status-amber); }
    .bg-red { background-color: var(--status-red); }

    /* Main Grid */
    .pillars-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
    }

    .pillar-card {
        background: var(--card-bg);
        padding: 20px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        display: flex;
        flex-direction: column;
        border-top: 3px solid transparent;
        transition: transform 0.2s;
    }
    
    .pillar-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }

    .pillar-card.status-green { border-top-color: var(--status-green); }
    .pillar-card.status-amber { border-top-color: var(--status-amber); }
    .pillar-card.status-red { border-top-color: var(--status-red); }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 10px;
    }

    .card-title {
        font-weight: 700;
        color: var(--primary-color);
    }

    .traffic-light {
        width: 15px;
        height: 15px;
        border-radius: 50%;
    }

    .kpi-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
        font-size: 14px;
    }

    .kpi-label {
        color: var(--text-light);
    }

    .kpi-value {
        font-weight: 600;
    }

    .insight-box {
        background-color: #f8f9fa;
        padding: 10px;
        border-left: 3px solid var(--accent-color);
        font-size: 13px;
        margin-top: auto;
        color: var(--text-color);
    }

    /* Simple CSS Charts */
    .chart-container {
        margin: 15px 0;
    }
    
    .bar-chart {
        display: flex;
        align-items: flex-end;
        height: 60px;
        gap: 10px;
        padding-bottom: 5px;
        border-bottom: 1px solid #ddd;
    }
    
    .bar {
        flex: 1;
        background-color: var(--accent-color);
        opacity: 0.7;
        position: relative;
        border-radius: 3px 3px 0 0;
        transition: height 0.5s ease;
    }
    
    .bar:hover { opacity: 1; }

    .bar-label {
        text-align: center;
        font-size: 10px;
        margin-top: 5px;
        color: var(--text-light);
    }

    .progress-bar-bg {
        background-color: #eee;
        height: 8px;
        border-radius: 4px;
        margin-top: 5px;
        overflow: hidden;
    }

    .progress-bar-fill {
        height: 100%;
        background-color: var(--primary-color);
        transition: width 1s ease-in-out;
    }
`;

// --- HELPERS ---
const getStatusClass = (status) => {
    if (status === 'red') return 'status-red';
    if (status === 'amber') return 'status-amber';
    return 'status-green'; // default
};

const getBgClass = (status) => {
    if (status === 'red') return 'bg-red';
    if (status === 'amber') return 'bg-amber';
    return 'bg-green';
};

// Helper functions to get display names
const getResourceDisplay = (resourceId, masterResources) => {
    if (!masterResources || !Array.isArray(masterResources) || masterResources.length === 0) return resourceId;
    const resource = masterResources.find(r => r.resource_id === resourceId);
    return resource ? `${resourceId} - ${resource.first_name} ${resource.last_name}` : resourceId;
};

const getSkillDisplay = (skillId, skills) => {
    if (!skills || !Array.isArray(skills) || skills.length === 0) return skillId;
    const skill = skills.find(s => s.skill_id === skillId);
    return skill ? `${skillId} - ${skill.skill_name}` : skillId;
};

const getProjectDisplay = (projectId, projects) => {
    if (!projects || !Array.isArray(projects) || projects.length === 0) return projectId;
    const project = projects.find(p => p.project_id === projectId);
    return project ? `${projectId} - ${project.project_name}` : projectId;
};

// CSV parsing helper function
const parseCSV = (csvText) => {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
  
  return { headers, rows };
};

// CSV upload component
const CSVUpload = ({ title, expectedHeaders, onUpload, loading }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setError('');
    setPreview(null);

    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const csvText = event.target.result;
        const { headers, rows } = parseCSV(csvText);
        
        // Validate headers
        const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          setError(`Missing required headers: ${missingHeaders.join(', ')}`);
          return;
        }
        
        setPreview({ headers, rows: rows.slice(0, 5), totalRows: rows.length });
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !preview) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvText = event.target.result;
      const { rows } = parseCSV(csvText);
      await onUpload(rows);
    };
    reader.readAsText(file);
  };

  return (
    <div style={{marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px'}}>
      <h4>{title}</h4>
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileChange}
        style={{marginBottom: '10px'}}
      />
      
      {error && (
        <div style={{color: 'red', marginBottom: '10px'}}>{error}</div>
      )}
      
      {preview && (
        <div style={{marginBottom: '10px'}}>
          <p>Found {preview.totalRows} rows. Preview of first 5:</p>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '12px'}}>
            <thead>
              <tr style={{backgroundColor: '#f5f5f5'}}>
                {preview.headers.map(header => (
                  <th key={header} style={{padding: '4px', border: '1px solid #ddd'}}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, index) => (
                <tr key={index}>
                  {preview.headers.map(header => (
                    <td key={header} style={{padding: '4px', border: '1px solid #ddd'}}>{row[header]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <button 
        onClick={handleUpload} 
        disabled={!preview || loading}
        style={{
          padding: '8px 16px',
          background: preview && !loading ? '#00a3e0' : '#ccc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: preview && !loading ? 'pointer' : 'not-allowed'
        }}
      >
        {loading ? 'Uploading...' : 'Upload Data'}
      </button>
    </div>
  );
};

// --- COMPONENTS ---

// 1. DASHBOARD COMPONENT (Implements your HTML structure)
const DashboardView = ({ data, onMonthChange, setView }) => {
  // Add safety check for data
  if (!data) {
    return <div style={{padding: '20px', textAlign: 'center'}}>Loading dashboard...</div>;
  }

  const { resources, timesheets, agile, slas, financials, milestones, rfc_tracking, project_cost_estimation, project_financials, defect_density, defect_detection_efficiency, master_resources } = data;

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showDefectDensityModal, setShowDefectDensityModal] = useState(false);
  const [showDefectDetectionEfficiencyModal, setShowDefectDetectionEfficiencyModal] = useState(false);
  const [showDefectEscapesToUATModal, setShowDefectEscapesToUATModal] = useState(false);
  const [showRfcModal, setShowRfcModal] = useState(false);
  const [showCostEstModal, setShowCostEstModal] = useState(false);
  const [showProjectFinancialModal, setShowProjectFinancialModal] = useState(false);

  // --- LIVE CALCULATIONS ---
  
  // 1. Capacity & Util
  const utilizationData = useMemo(() => {
    if (!timesheets || !timesheets.length) return { util: 0, flexRatio: 0, status: 'green', flexHours: 0 };
    const weeks = [...new Set(timesheets.map(t => t.week))].sort();
    const lastWeek = weeks[weeks.length - 1];
    const weekLogs = timesheets.filter(t => t.week === lastWeek);
    
    const totalCore = weekLogs.reduce((acc, curr) => acc + Number(curr.coreHours), 0);
    const totalFlex = weekLogs.reduce((acc, curr) => acc + Number(curr.flexHours), 0);
    const supplierCount = resources.filter(r => r.org === 'Supplier').length || 71;
    const capacity = supplierCount * 40; 
    
    const util = Math.round(((totalCore + totalFlex) / (capacity || 1)) * 100);
    
    let status = 'green';
    if (util > 95) status = 'red';
    else if (util > 90) status = 'amber';

    return {
      util,
      flexRatio: Math.round((totalFlex / (totalCore || 1)) * 100),
      flexHours: totalFlex,
      status
    };
  }, [timesheets, resources]);

  // 2. Velocity
  const velocityData = useMemo(() => {
    if (!agile || !agile.length) return { current: 0, status: 'green' };
    const sprints = [...new Set(agile.map(a => a.sprint))].sort();
    const lastSprint = sprints[sprints.length - 1];
    const sp = agile.filter(a => a.sprint === lastSprint && a.status === 'Done')
                    .reduce((acc, curr) => acc + Number(curr.storyPoints), 0);
    
    return { current: sp, status: sp < 30 ? 'amber' : 'green' };
  }, [agile]);

  // 3. SLAs (Project Mgmt + Execution)
  const slaStatus = useMemo(() => {
    if (!slas || !slas.length) return { density: 0, escapes: 0, spi: 0.98, status: 'green' };
    const sprints = [...new Set(slas.map(s => s.sprint))].sort();
    const lastSprint = sprints[sprints.length - 1];
    const currentSLAs = slas.filter(s => s.sprint === lastSprint);
    
    const density = currentSLAs.reduce((acc, curr) => acc + Number(curr.defectDensity), 0) / (currentSLAs.length || 1);
    // Mock SPI based on density for demo purposes if not strictly tracked
    const spi = density > 0.1 ? 0.92 : 0.98;
    
    return { 
        density: density.toFixed(2), 
        escapes: currentSLAs.reduce((acc, curr) => acc + Number(curr.uatEscapes), 0),
        spi,
        status: density > 0.1 ? 'amber' : 'green'
    };
  }, [slas]);

  // 3.5. Milestone Hit Rate
  const milestoneStatus = useMemo(() => {
    if (!milestones || !milestones.length) return { hitRate: 100, total: 0, achieved: 0, status: 'green', filteredMilestones: [] };
    const monthMilestones = milestones.filter(m => m.axiaMilestoneDueDate && m.axiaMilestoneDueDate.startsWith(selectedMonth));
    const total = monthMilestones.length;
    const achieved = monthMilestones.filter(m => m.axiaMilestoneStatus === 'Achieved').length;
    const hitRate = total > 0 ? Math.round((achieved / total) * 100) : 100;
    let status = 'green';
    if (hitRate < 80) status = 'red';
    else if (hitRate < 90) status = 'amber';
    return { hitRate, total, achieved, status, filteredMilestones: monthMilestones };
  }, [milestones, selectedMonth]);

  // RFC Status calculation
  const rfcStatus = useMemo(() => {
    if (!rfc_tracking || !rfc_tracking.length) return { rate: 0, status: 'green', count: 0, filteredRfc: [] };
    const monthRfc = rfc_tracking.filter(r => r.delta_requirements_lock_date && r.delta_requirements_lock_date.startsWith(selectedMonth));
    const total = monthRfc.length;
    if (total === 0) return { rate: 0, status: 'green', count: 0, filteredRfc: [] };
    
    const totalBase = monthRfc.reduce((sum, r) => sum + (r.base_requirements_count || 0), 0);
    const totalDelta = monthRfc.reduce((sum, r) => sum + (r.delta_requirements_count || 0), 0);
    const rate = totalBase > 0 ? (totalDelta / totalBase) * 100 : 0;
    
    let status = 'green';
    if (rate > 10) status = 'red';
    else if (rate > 5) status = 'amber';
    
    return { rate: Math.round(rate * 100) / 100, status, count: total, filteredRfc: monthRfc };
  }, [rfc_tracking, selectedMonth]);

  // Project Cost Estimation Status
  const costEstStatus = useMemo(() => {
    if (!project_cost_estimation || !project_cost_estimation.length) return { rate: 0, status: 'green', count: 0, filtered: [] };
    
    // Filter by month based on submission date
    const monthData = project_cost_estimation.filter(r => r.estimation_submitted_date && r.estimation_submitted_date.startsWith(selectedMonth));
    const total = monthData.length;
    
    if (total === 0) return { rate: 0, status: 'green', count: 0, filtered: [] };
    
    const withinSla = monthData.filter(r => r.completed_within_sla === 'Yes').length;
    const rate = Math.round((withinSla / total) * 100);
    
    return { rate, status: rate < 80 ? 'red' : rate < 90 ? 'amber' : 'green', count: total, filtered: monthData };
  }, [project_cost_estimation, selectedMonth]);

  // Project Financial Status
  const projectFinancialStatus = useMemo(() => {
    if (!project_financials || !project_financials.length) return { accuracy: 0, status: 'green', count: 0, filtered: [] };
    
    // Filter by month based on actual date
    const monthData = project_financials.filter(r => r.monthly_actual_date && r.monthly_actual_date.startsWith(selectedMonth));
    const total = monthData.length;
    
    if (total === 0) return { accuracy: 0, status: 'green', count: 0, filtered: [] };
    
    // Calculate project-level accuracy: (Forecast - Actual) / Forecast
    const projectAccuracies = {};
    
    monthData.forEach(record => {
      const axiaId = record.axia_id;
      const forecast = Number(record.monthly_forecast_amount) || 0;
      const actual = Number(record.monthly_actual_amount) || 0;
      
      if (!projectAccuracies[axiaId]) {
        projectAccuracies[axiaId] = { totalForecast: 0, totalActual: 0 };
      }
      
      projectAccuracies[axiaId].totalForecast += forecast;
      projectAccuracies[axiaId].totalActual += actual;
    });
    
    // Calculate average accuracy across all projects
    const accuracies = Object.values(projectAccuracies).map(({ totalForecast, totalActual }) => {
      if (totalForecast === 0) return 0;
      return Math.abs((totalForecast - totalActual) / totalForecast);
    });
    
    const avgAccuracy = accuracies.length > 0 ? accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length : 0;
    const accuracyPercent = Math.round((1 - avgAccuracy) * 100);
    
    let status = 'green';
    if (accuracyPercent < 80) status = 'red';
    else if (accuracyPercent < 90) status = 'amber';
    
    return { accuracy: accuracyPercent, status, count: total, filtered: monthData };
  }, [project_financials, selectedMonth]);

  // Defect Density Status
  const defectDensityStatus = useMemo(() => {
    if (!defect_density || !defect_density.length) return { density: 0, status: 'green', count: 0, filtered: [] };
    
    // Filter by month based on reported date
    const monthData = defect_density.filter(r => r.reported_date && r.reported_date.startsWith(selectedMonth));
    const total = monthData.length;
    
    if (total === 0) return { density: 0, status: 'green', count: 0, filtered: [] };
    
    // Calculate average defect density
    const totalDensity = monthData.reduce((sum, r) => sum + (r.defect_density_percentage || 0), 0);
    const avgDensity = totalDensity / total;
    
    let status = 'green';
    if (avgDensity < 95) status = 'red';
    else if (avgDensity < 90) status = 'amber';
    
    return { density: Math.round(avgDensity * 100) / 100, status, count: total, filtered: monthData };
  }, [defect_density, selectedMonth]);

  // Defect Detection Efficiency Status
  const defectDetectionEfficiencyStatus = useMemo(() => {
    if (!defect_detection_efficiency || !defect_detection_efficiency.length) return { efficiency: 0, status: 'green', count: 0, filtered: [] };
    
    // Filter by month based on reported date
    const monthData = defect_detection_efficiency.filter(r => r.reported_date && r.reported_date.startsWith(selectedMonth));
    const total = monthData.length;
    
    if (total === 0) return { efficiency: 0, status: 'green', count: 0, filtered: [] };
    
    // Calculate average defect detection efficiency: (A - B) / (C + D)
    // A = defects_found_by_supplier, B = supplier_defects_rejected_by_cpchem
    // C = defects_found_by_cpchem, D = defects_rejected_during_uat_production
    const totalEfficiency = monthData.reduce((sum, r) => {
      const A = Number(r.defects_found_by_supplier) || 0;
      const B = Number(r.supplier_defects_rejected_by_cpchem) || 0;
      const C = Number(r.defects_found_by_cpchem) || 0;
      const D = Number(r.defects_rejected_during_uat_production) || 0;
      const denominator = C + D;
      const efficiency = denominator > 0 ? (A - B) / denominator : 0;
      return sum + efficiency;
    }, 0);
    
    const avgEfficiency = totalEfficiency / total;
    const efficiencyPercent = Math.round(avgEfficiency * 100 * 100) / 100; // Convert to percentage
    
    let status = 'green';
    if (efficiencyPercent < 80) status = 'red';
    else if (efficiencyPercent < 90) status = 'amber';
    
    return { efficiency: efficiencyPercent, status, count: total, filtered: monthData };
  }, [defect_detection_efficiency, selectedMonth]);

  // Defect Escapes to UAT Status
  const defectEscapesToUATStatus = useMemo(() => {
    if (!defect_detection_efficiency || !defect_detection_efficiency.length) return { escapesRate: 0, status: 'green', count: 0, filtered: [] };

    const monthData = defect_detection_efficiency.filter(r => r.reported_date && r.reported_date.startsWith(selectedMonth));
    const totalRecords = monthData.length;

    if (totalRecords === 0) return { escapesRate: 0, status: 'green', count: 0, filtered: [] };

    let totalEscapedSITDefects = 0; // A: defects_found_by_cpchem (defects found by CPChem, implying they escaped supplier's SIT)
    let totalSITDefectsBySupplier = 0; // B: defects_found_by_supplier (SIT defects found by Supplier)
    let totalUATDefectsFound = 0; // C: defects_rejected_during_uat_production (UAT defects found)

    monthData.forEach(record => {
      totalEscapedSITDefects += Number(record.defects_found_by_cpchem) || 0;
      totalSITDefectsBySupplier += Number(record.defects_found_by_supplier) || 0;
      totalUATDefectsFound += Number(record.defects_rejected_during_uat_production) || 0;
    });

    const denominator = totalSITDefectsBySupplier + totalUATDefectsFound;
    const escapesRate = denominator > 0 ? (totalEscapedSITDefects / denominator) * 100 : 0;

    let status = 'green';
    if (escapesRate > 20) status = 'red';
    else if (escapesRate > 10) status = 'amber';

    return { escapesRate: Math.round(escapesRate * 100) / 100, status, count: totalRecords, filtered: monthData };
  }, [defect_detection_efficiency, selectedMonth]);
  // 4. Financials (Demand Bars)
  const financialData = useMemo(() => {
     if (!financials || !financials.length) return [];
     // Sort by month
     return [...financials].sort((a,b) => a.month.localeCompare(b.month)).slice(0, 3);
  }, [financials]);

  try {
    return (
      <div className="dashboard-container animate-fade-in">
          <style>{styles}</style>
        
        {/* HEADER */}
        <header className="header">
            <div>
                <h1>Squad Execution Governance Dashboard</h1>
                <div style={{fontSize: '13px', marginTop: '5px', color: '#666'}}>
                    Supplier: {resources.filter(r => r.org === 'Supplier').length || 71} FTE | 
                    Customer: {resources.filter(r => r.org === 'Customer').length || 72} FTE | 
                    Period: Current
                </div>
            </div>
            <div className="header-meta">
                <div style={{marginBottom: '10px'}}>
                    <label style={{fontSize: '14px', marginRight: '10px'}}>Select Month:</label>
                    <input 
                        type="month" 
                        value={selectedMonth} 
                        onChange={e => setSelectedMonth(e.target.value)}
                        style={{padding: '5px', border: '1px solid #ccc', borderRadius: '4px'}}
                    />
                </div>
                <button 
                    onClick={() => window.print()} 
                    style={{padding: '8px 16px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
                >
                    Export Report
                </button>
                <div style={{marginTop: '5px'}}>Live Data</div>
            </div>
        </header>

        {/* EXEC SUMMARY */}
        <section className="exec-summary">
            <div className="exec-card">
                <div className={`status-badge ${getBgClass(utilizationData.status)}`}>
                    OPERATIONAL STATUS: {utilizationData.status === 'green' ? 'STABLE' : 'AT RISK'}
                </div>
                <div className="exec-title">Executive Insight</div>
                <div className="exec-statement">
                    Squad velocity is {velocityData.current} SP (SPI {slaStatus.spi}). 
                    {utilizationData.util > 90 
                        ? " Capacity risks are critical. Utilization > 90% indicates immediate burnout risk." 
                        : " Operations are stable. Utilization is within healthy thresholds."}
                </div>
            </div>
            <div className="exec-card">
                <div className="exec-title">Critical Decision Required</div>
                <div style={{fontWeight: 'bold', color: 'var(--status-red)', marginBottom: '5px'}}>
                    {utilizationData.util > 90 ? "Capacity Expansion" : "Backlog Preparation"}
                </div>
                <p style={{fontSize: '13px', margin: 0}}>
                    {utilizationData.util > 90 
                        ? "Approve 1 new squad (7 FTEs) to handle demand surge." 
                        : "Focus on increasing Definition of Ready (DoR) pass rate."}
                </p>
            </div>
        </section>

        {/* MAIN GRID */}
        <div className="pillars-grid">

            {/* 1. Project Management */}
            <div className={`pillar-card ${getStatusClass(milestoneStatus.status === 'red' || rfcStatus.status === 'red' || costEstStatus.status === 'red' || projectFinancialStatus.status === 'red' ? 'red' : milestoneStatus.status === 'amber' || rfcStatus.status === 'amber' || costEstStatus.status === 'amber' || projectFinancialStatus.status === 'amber' ? 'amber' : 'green')}`}>
                <div className="card-header">
                    <span className="card-title">1. Project Management</span>
                    <div className={`traffic-light ${getBgClass(milestoneStatus.status === 'red' || rfcStatus.status === 'red' || costEstStatus.status === 'red' || projectFinancialStatus.status === 'red' ? 'red' : milestoneStatus.status === 'amber' || rfcStatus.status === 'amber' || costEstStatus.status === 'amber' || projectFinancialStatus.status === 'amber' ? 'amber' : 'green')}`}></div>
                </div>
                <div className="kpi-row">
                    <span className="kpi-label">SPI (Schedule)</span>
                    <span className="kpi-value">{slaStatus.spi}</span>
                </div>
                <div className="kpi-row">
                    <span className="kpi-label">CPI (Cost)</span>
                    <span className="kpi-value">0.98</span>
                </div>
                <div className="kpi-row">
                    <span 
                        className="kpi-label" 
                        style={{cursor: 'pointer', textDecoration: 'underline'}} 
                        onClick={() => setShowMilestoneModal(true)}
                    >
                        Milestone Hit Rate
                    </span>
                    <span className="kpi-value">{milestoneStatus.hitRate}%</span>
                </div>
                <div className="kpi-row">
                    <span 
                        className="kpi-label"
                        style={{cursor: 'pointer', textDecoration: 'underline'}}
                        onClick={() => setShowRfcModal(true)}
                    >
                        RFC Rate
                    </span>
                    <span className="kpi-value">{rfcStatus.rate}%</span>
                </div>
                <div className="kpi-row">
                    <span 
                        className="kpi-label"
                        style={{cursor: 'pointer', textDecoration: 'underline'}}
                        onClick={() => setShowCostEstModal(true)}
                    >Cost Est. Timeliness</span>
                    <span className="kpi-value">{costEstStatus.rate}%</span>
                </div>
                <div className="kpi-row">
                    <span 
                        className="kpi-label"
                        style={{cursor: 'pointer', textDecoration: 'underline'}}
                        onClick={() => setShowProjectFinancialModal(true)}
                    >Financial Accuracy</span>
                    <span className="kpi-value">{projectFinancialStatus.accuracy}%</span>
                </div>
                <div className="insight-box">
                    {milestoneStatus.total > 0 ? `${milestoneStatus.achieved}/${milestoneStatus.total} milestones achieved.` : ''}
                    {rfcStatus.count > 0 && ` ${rfcStatus.count} RFC${rfcStatus.count > 1 ? 's' : ''} tracked.`}
                    {costEstStatus.count > 0 && ` ${costEstStatus.count} Cost Est. processed.`}
                    {projectFinancialStatus.count > 0 && ` ${projectFinancialStatus.count} Financial record${projectFinancialStatus.count > 1 ? 's' : ''} tracked.`}
                    {milestoneStatus.total === 0 && rfcStatus.count === 0 && costEstStatus.count === 0 && projectFinancialStatus.count === 0 && 'No data for this month.'}
                </div>
            </div>

            {/* 2. Demand Forecasting */}
            <div className="pillar-card status-amber">
                <div className="card-header">
                    <span className="card-title">2. Demand Forecasting</span>
                    <div className="traffic-light bg-amber"></div>
                </div>
                <div className="kpi-row">
                    <span className="kpi-label">Forecast Accuracy</span>
                    <span className="kpi-value" style={{color: 'var(--status-red)'}}>88%</span>
                </div>
                
                {/* Dynamic CSS Bar Chart */}
                <div className="chart-container">
                    <div style={{fontSize: '11px', marginBottom: '5px'}}>Demand (SP) vs Capacity (500)</div>
                    <div className="bar-chart">
                        {financialData.map((f, i) => {
                            const height = Math.min((f.demand / 700) * 100, 100);
                            const isOver = f.demand > f.capacity;
                            return (
                                <div key={i} className="bar" style={{height: `${height}%`, backgroundColor: isOver ? 'var(--status-red)' : 'var(--accent-color)'}} title={`${f.month}: ${f.demand} SP`}></div>
                            );
                        })}
                        {financialData.length === 0 && <div style={{fontSize:'12px', padding:'10px'}}>No financial data</div>}
                    </div>
                </div>
                
                <div className="insight-box">
                    Warning: Month 3 forecast exceeds current capacity cap.
                </div>
            </div>

            {/* 3. Work Intake */}
            <div className="pillar-card status-red">
                <div className="card-header">
                    <span className="card-title">3. Work Intake</span>
                    <div className="traffic-light bg-red"></div>
                </div>
                <div className="kpi-row">
                    <span className="kpi-label">Definition of Ready %</span>
                    <span className="kpi-value" style={{color: 'var(--status-red)'}}>65%</span>
                </div>
                <div className="kpi-row">
                    <span className="kpi-label">Cycle Time (Avg)</span>
                    <span className="kpi-value">14 Days</span>
                </div>
                <div className="kpi-row">
                    <span className="kpi-label">Backlog Health</span>
                    <span className="kpi-value">1.2 Sprints</span>
                </div>
                <div className="insight-box">
                    Critical bottleneck: Low "Ready" rate is starving squads.
                </div>
            </div>

            {/* 4. Squad Formation */}
            <div className="pillar-card status-green">
                <div className="card-header">
                    <span className="card-title">4. Squad Formation</span>
                    <div className="traffic-light bg-green"></div>
                </div>
                <div className="kpi-row">
                    <span className="kpi-label">Time to Productivity</span>
                    <span className="kpi-value">12 Days</span>
                </div>
                <div className="kpi-row">
                    <span className="kpi-label">Health Score</span>
                    <span className="kpi-value">4.2 / 5.0</span>
                </div>
                <div className="kpi-row">
                    <span className="kpi-label">Attrition (Voluntary)</span>
                    <span className="kpi-value">0%</span>
                </div>
                <div className="insight-box">
                    Team morale is high. Onboarding time reduced by 3 days.
                </div>
            </div>

            {/* 5. Flex Management */}
            <div className={`pillar-card ${utilizationData.flexRatio > 10 ? 'status-amber' : 'status-green'}`}>
                <div className="card-header">
                    <span className="card-title">5. Flex Management</span>
                    <div className={`traffic-light ${utilizationData.flexRatio > 10 ? 'bg-amber' : 'bg-green'}`}></div>
                </div>
                <div className="kpi-row">
                    <span className="kpi-label">Core Hours Adherence</span>
                    <span className="kpi-value">98%</span>
                </div>
                <div className="kpi-row">
                    <span className="kpi-label">Flex Ratio</span>
                    <span className="kpi-value" style={{color: utilizationData.flexRatio > 10 ? 'var(--status-red)' : 'inherit'}}>
                        {utilizationData.flexRatio}%
                    </span>
                </div>
                <div className="kpi-row">
                    <span className="kpi-label">Flex Balance</span>
                    <span className="kpi-value">+{utilizationData.flexHours} hrs</span>
                </div>
                <div className="insight-box">
                    Flex usage trending high to compensate for Intake delays.
                </div>
            </div>

            {/* 6. Capacity & Util */}
            <div className={`pillar-card ${getStatusClass(utilizationData.status)}`}>
                <div className="card-header">
                    <span className="card-title">6. Capacity & Util.</span>
                    <div className={`traffic-light ${getBgClass(utilizationData.status)}`}></div>
                </div>
                <div style={{marginBottom: '10px'}}>
                    <div className="kpi-row" style={{marginBottom: '2px'}}>
                        <span className="kpi-label">Effective Utilization</span>
                        <span className="kpi-value">{utilizationData.util}%</span>
                    </div>
                    <div className="progress-bar-bg">
                        <div 
                            className="progress-bar-fill" 
                            style={{
                                width: `${Math.min(utilizationData.util, 100)}%`, 
                                backgroundColor: utilizationData.status === 'red' ? 'var(--status-red)' : (utilizationData.status === 'amber' ? 'var(--status-amber)' : 'var(--status-green)')
                            }}
                        ></div>
                    </div>
                    <div style={{fontSize: '10px', color: '#999', textAlign: 'right', marginTop: '2px'}}>Target: 85%</div>
                </div>
                <div className="kpi-row">
                    <span className="kpi-label">Billable vs Productive</span>
                    <span className="kpi-value">4% Gap</span>
                </div>
                <div className="insight-box">
                    {utilizationData.util > 90 ? "Teams are running hot (>90%). Burnout risk." : "Capacity is well managed."}
                </div>
            </div>

            {/* 7. Execution */}
            <div className={`pillar-card ${getStatusClass(
                defectDetectionEfficiencyStatus.status === 'red' || defectEscapesToUATStatus.status === 'red' ? 'red' :
                defectDetectionEfficiencyStatus.status === 'amber' || defectEscapesToUATStatus.status === 'amber' ? 'amber' :
                'green'
            )}`}>
                <div className="card-header">
                    <span className="card-title">7. Project Execution</span>
                    <div className={`traffic-light ${getBgClass(defectDetectionEfficiencyStatus.status === 'red' || defectEscapesToUATStatus.status === 'red' ? 'red' : defectDetectionEfficiencyStatus.status === 'amber' || defectEscapesToUATStatus.status === 'amber' ? 'amber' : 'green')}`}></div>
                </div>
                <div className="kpi-row">
                    <span className="kpi-label">Velocity (Avg)</span>
                    <span className="kpi-value">{velocityData.current} SP</span>
                </div>
                <div className="kpi-row">
                    <span 
                        className="kpi-label"
                        style={{cursor: 'pointer', textDecoration: 'underline'}}
                        onClick={() => setShowDefectDensityModal(true)}
                    >Defect Density</span>
                    <span className="kpi-value">{defectDensityStatus.density}%</span>
                </div>
                <div className="kpi-row">
                    <span 
                        className="kpi-label"
                        style={{cursor: 'pointer', textDecoration: 'underline'}}
                        onClick={() => setShowDefectDetectionEfficiencyModal(true)}
                    >Defect Detection Efficiency</span>
                    <span className="kpi-value">{defectDetectionEfficiencyStatus.efficiency}%</span>
                </div>
                <div className="kpi-row">
                    <span className="kpi-label">UAT Escapes</span>
                    <span className="kpi-value">{slaStatus.escapes}</span>
                </div>
                <div className="kpi-row">
                    <span 
                        className="kpi-label"
                        style={{cursor: 'pointer', textDecoration: 'underline'}}
                        onClick={() => setShowDefectEscapesToUATModal(true)}
                    >Defect Escapes to UAT</span>
                    <span className="kpi-value">{defectEscapesToUATStatus.escapesRate}%</span>
                </div>
                <div className="insight-box">
                    {defectDetectionEfficiencyStatus.count > 0 ? `${defectDetectionEfficiencyStatus.count} defect detection efficiency record${defectDetectionEfficiencyStatus.count > 1 ? 's' : ''} tracked.` : 'No defect detection efficiency data for this month.'} {defectEscapesToUATStatus.count > 0 && ` ${defectEscapesToUATStatus.count} defect escape record${defectEscapesToUATStatus.count > 1 ? 's' : ''} tracked.`}
                </div>
            </div>

        </div>

        {/* MILESTONE DETAILS MODAL */}
        {showMilestoneModal && (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
            }} onClick={() => setShowMilestoneModal(false)}>
                <div style={{
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    maxWidth: '800px',
                    maxHeight: '80vh',
                    overflow: 'auto',
                    width: '90%'
                }} onClick={e => e.stopPropagation()}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                        <h3 style={{margin: 0, color: '#051c2c'}}>Milestone Details - {selectedMonth}</h3>
                        <button 
                            onClick={() => setShowMilestoneModal(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '20px',
                                cursor: 'pointer',
                                color: '#666'
                            }}
                        >
                            ×
                        </button>
                    </div>
                    
                    {milestoneStatus.filteredMilestones.length === 0 ? (
                        <p style={{textAlign: 'center', color: '#666'}}>No milestones found for this month.</p>
                    ) : (
                        <div style={{display: 'grid', gap: '15px'}}>
                            {milestoneStatus.filteredMilestones.map((milestone, index) => (
                                <div key={index} style={{
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '4px',
                                    padding: '15px',
                                    backgroundColor: milestone.axiaMilestoneStatus === 'Achieved' ? '#f0f9f0' : 
                                                   milestone.axiaMilestoneStatus === 'Delayed' ? '#fff5f5' : '#f9f9f9'
                                }}>
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                        <div><strong>Project:</strong> {milestone.axiaName} ({milestone.axiaId})</div>
                                        <div><strong>Status:</strong> 
                                            <span style={{
                                                color: milestone.axiaMilestoneStatus === 'Achieved' ? '#2ecc71' :
                                                       milestone.axiaMilestoneStatus === 'Delayed' ? '#e74c3c' :
                                                       milestone.axiaMilestoneStatus === 'At Risk' ? '#f39c12' : '#3498db',
                                                fontWeight: 'bold'
                                            }}>
                                                {milestone.axiaMilestoneStatus}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{marginBottom: '8px'}}><strong>Milestone:</strong> {milestone.axiaMilestone}</div>
                                    <div style={{marginBottom: '8px'}}><strong>Description:</strong> {milestone.axiaMilestoneDescription}</div>
                                    <div style={{marginBottom: '8px'}}><strong>Objective:</strong> {milestone.axiaMilestoneObjective}</div>
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '8px'}}>
                                        <div><strong>Due Date:</strong> {new Date(milestone.axiaMilestoneDueDate).toLocaleDateString()}</div>
                                        <div><strong>Owner CPC:</strong> {milestone.axiaOwnerCpc}</div>
                                        <div><strong>Owner LTIM:</strong> {milestone.axiaMilestoneOwnerLtim}</div>
                                    </div>
                                    <div style={{marginBottom: '8px'}}><strong>Status Description:</strong> {milestone.axiaMilestoneStatusDescription}</div>
                                    <div><strong>Status Date:</strong> {new Date(milestone.axiaMilestoneStatusDate).toLocaleDateString()}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div style={{marginTop: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
                        <strong>Summary:</strong> {milestoneStatus.achieved} of {milestoneStatus.total} milestones achieved ({milestoneStatus.hitRate}%)
                    </div>
                </div>
            </div>
        )}

        {/* DEFECT DENSITY DETAILS MODAL */}
        {showDefectDensityModal && (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
            }} onClick={() => setShowDefectDensityModal(false)}>
                <div style={{
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    maxWidth: '800px',
                    maxHeight: '80vh',
                    overflow: 'auto',
                    width: '90%'
                }} onClick={e => e.stopPropagation()}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                        <h3 style={{margin: 0, color: '#051c2c'}}>Defect Density Details - {selectedMonth}</h3>
                        <button 
                            onClick={() => setShowDefectDensityModal(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '20px',
                                cursor: 'pointer',
                                color: '#666'
                            }}
                        >
                            ×
                        </button>
                    </div>
                    
                    {defectDensityStatus.filtered.length === 0 ? (
                        <p style={{textAlign: 'center', color: '#666'}}>No defect density records found for this month.</p>
                    ) : (
                        <div style={{display: 'grid', gap: '15px'}}>
                            {defectDensityStatus.filtered.map((record, index) => {
                                const density = record.defect_density_percentage || 0;
                                const status = density >= 95 ? 'green' : density >= 90 ? 'amber' : 'red';
                                const statusColor = status === 'green' ? '#2ecc71' : status === 'amber' ? '#f39c12' : '#e74c3c';
                                
                                return (
                                    <div key={record.id || index} style={{
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '4px',
                                        padding: '15px',
                                        backgroundColor: '#f9f9f9'
                                    }}>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                            <div><strong>Project ID:</strong> {record.axia_id}</div>
                                            <div><strong>Status:</strong> 
                                                <span style={{
                                                    color: statusColor,
                                                    fontWeight: 'bold',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {status}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                            <div><strong>Defects Reported:</strong> {record.defects_reported_during_warranty || 'N/A'}</div>
                                            <div><strong>Test Cases:</strong> {record.test_cases_during_warranty || 'N/A'}</div>
                                        </div>
                                        <div style={{marginBottom: '10px'}}>
                                            <strong>Defect Density:</strong> 
                                            <span style={{color: statusColor, fontWeight: 'bold', fontSize: '16px'}}>
                                                {density.toFixed(2)}%
                                            </span>
                                        </div>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                            <div><strong>Warranty Start:</strong> {record.warranty_period_start_date ? new Date(record.warranty_period_start_date).toLocaleDateString() : 'N/A'}</div>
                                            <div><strong>Warranty End:</strong> {record.warranty_period_end_date ? new Date(record.warranty_period_end_date).toLocaleDateString() : 'N/A'}</div>
                                        </div>
                                        <div style={{marginBottom: '10px'}}><strong>Reported Date:</strong> {record.reported_date ? new Date(record.reported_date).toLocaleDateString() : 'N/A'}</div>
                                        {record.comment && (
                                            <div><strong>Comment:</strong> {record.comment}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    
                    <div style={{marginTop: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
                        <strong>Summary:</strong> {defectDensityStatus.count} defect density record{defectDensityStatus.count !== 1 ? 's' : ''} tracked. 
                        Average defect density: {defectDensityStatus.density}%
                    </div>
                </div>
            </div>
        )}

        {/* RFC DETAILS MODAL */}
        {showRfcModal && (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
            }} onClick={() => setShowRfcModal(false)}>
                <div style={{
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    maxWidth: '800px',
                    maxHeight: '80vh',
                    overflow: 'auto',
                    width: '90%'
                }} onClick={e => e.stopPropagation()}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                        <h3 style={{margin: 0, color: '#051c2c'}}>RFC Details - {selectedMonth}</h3>
                        <button onClick={() => setShowRfcModal(false)} style={{background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666'}}>×</button>
                    </div>
                    {rfcStatus.filteredRfc.length === 0 ? (
                        <p style={{textAlign: 'center', color: '#666'}}>No RFC records found for this month.</p>
                    ) : (
                        <div style={{display: 'grid', gap: '15px'}}>
                            {rfcStatus.filteredRfc.map((rfc, index) => (
                                <div key={index} style={{border: '1px solid #e0e0e0', borderRadius: '4px', padding: '15px', backgroundColor: '#f9f9f9'}}>
                                    <div style={{marginBottom: '10px'}}><strong>Project ID:</strong> {rfc.axia_id}</div>
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                                        <div>
                                            <strong>Base Requirements:</strong> {rfc.base_requirements_count}<br/>
                                            <span style={{fontSize: '12px', color: '#666'}}>Locked: {rfc.base_requirements_lock_date ? new Date(rfc.base_requirements_lock_date).toLocaleDateString() : 'N/A'}</span>
                                            {rfc.base_requirements_details && <div style={{fontSize: '13px', marginTop: '5px', fontStyle: 'italic'}}>{rfc.base_requirements_details}</div>}
                                        </div>
                                        <div>
                                            <strong>Delta Requirements:</strong> {rfc.delta_requirements_count}<br/>
                                            <span style={{fontSize: '12px', color: '#666'}}>Locked: {rfc.delta_requirements_lock_date ? new Date(rfc.delta_requirements_lock_date).toLocaleDateString() : 'N/A'}</span>
                                            {rfc.delta_requirements_details && <div style={{fontSize: '13px', marginTop: '5px', fontStyle: 'italic'}}>{rfc.delta_requirements_details}</div>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* COST ESTIMATION DETAILS MODAL */}
        {showCostEstModal && (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
            }} onClick={() => setShowCostEstModal(false)}>
                <div style={{
                    backgroundColor: 'white', padding: '20px', borderRadius: '8px', maxWidth: '800px',
                    maxHeight: '80vh', overflow: 'auto', width: '90%'
                }} onClick={e => e.stopPropagation()}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                        <h3 style={{margin: 0, color: '#051c2c'}}>Cost Estimation Details - {selectedMonth}</h3>
                        <button onClick={() => setShowCostEstModal(false)} style={{background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666'}}>×</button>
                    </div>
                    {costEstStatus.filtered.length === 0 ? (
                        <p style={{textAlign: 'center', color: '#666'}}>No Cost Estimation records found for this month.</p>
                    ) : (
                        <div style={{display: 'grid', gap: '15px'}}>
                            {costEstStatus.filtered.map((record, index) => (
                                <div key={index} style={{border: '1px solid #e0e0e0', borderRadius: '4px', padding: '15px', backgroundColor: '#f9f9f9'}}>
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                        <div><strong>Axia ID:</strong> {record.axia_id}</div>
                                        <div><strong>Within SLA:</strong> <span style={{color: record.completed_within_sla === 'Yes' ? '#2ecc71' : '#e74c3c', fontWeight: 'bold'}}>{record.completed_within_sla}</span></div>
                                    </div>
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                                        <div><strong>Requested:</strong> {record.estimation_requested_date ? new Date(record.estimation_requested_date).toLocaleDateString() : 'N/A'}</div>
                                        <div><strong>Submitted:</strong> {record.estimation_submitted_date ? new Date(record.estimation_submitted_date).toLocaleDateString() : 'N/A'}</div>
                                    </div>
                                    <div style={{marginTop: '10px'}}><strong>Primary Contact:</strong> {getResourceDisplay(record.primary_contact, master_resources)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* PROJECT FINANCIAL DETAILS MODAL */}
        {showProjectFinancialModal && (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
            }} onClick={() => setShowProjectFinancialModal(false)}>
                <div style={{
                    backgroundColor: 'white', padding: '20px', borderRadius: '8px', maxWidth: '1000px',
                    maxHeight: '80vh', overflow: 'auto', width: '90%'
                }} onClick={e => e.stopPropagation()}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                        <h3 style={{margin: 0, color: '#051c2c'}}>Project Financial Details - {selectedMonth}</h3>
                        <button onClick={() => setShowProjectFinancialModal(false)} style={{background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666'}}>×</button>
                    </div>
                    {projectFinancialStatus.filtered.length === 0 ? (
                        <p style={{textAlign: 'center', color: '#666'}}>No Project Financial records found for this month.</p>
                    ) : (
                        <div style={{display: 'grid', gap: '15px'}}>
                            {projectFinancialStatus.filtered.map((record, index) => {
                                const forecast = Number(record.monthly_forecast_amount) || 0;
                                const actual = Number(record.monthly_actual_amount) || 0;
                                const variance = forecast > 0 ? ((forecast - actual) / forecast) * 100 : 0;
                                const varianceColor = Math.abs(variance) > 20 ? '#e74c3c' : Math.abs(variance) > 10 ? '#f39c12' : '#2ecc71';
                                
                                return (
                                    <div key={index} style={{border: '1px solid #e0e0e0', borderRadius: '4px', padding: '15px', backgroundColor: '#f9f9f9'}}>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                            <div><strong>Axia ID:</strong> {record.axia_id}</div>
                                            <div><strong>Supplier:</strong> {record.supplier_name}</div>
                                            <div><strong>Variance:</strong> <span style={{color: varianceColor, fontWeight: 'bold'}}>{variance.toFixed(1)}%</span></div>
                                        </div>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px'}}>
                                            <div><strong>Forecast ($):</strong> {forecast.toLocaleString()}</div>
                                            <div><strong>Forecast Date:</strong> {record.monthly_forecast_date ? new Date(record.monthly_forecast_date).toLocaleDateString() : 'N/A'}</div>
                                            <div><strong>Actual ($):</strong> {actual.toLocaleString()}</div>
                                            <div><strong>Actual Date:</strong> {record.monthly_actual_date ? new Date(record.monthly_actual_date).toLocaleDateString() : 'N/A'}</div>
                                        </div>
                                        {record.comment && (
                                            <div style={{marginTop: '10px'}}><strong>Comment:</strong> {record.comment}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div style={{marginTop: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
                        <strong>Summary:</strong> {projectFinancialStatus.count} financial record{projectFinancialStatus.count !== 1 ? 's' : ''} tracked. Average accuracy: {projectFinancialStatus.accuracy}%
                    </div>
                </div>
            </div>
        )}

        {/* DEFECT DENSITY DETAILS MODAL */}
        {showDefectDensityModal && (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
            }} onClick={() => setShowDefectDensityModal(false)}>
                <div style={{
                    backgroundColor: 'white', padding: '20px', borderRadius: '8px', maxWidth: '1000px',
                    maxHeight: '80vh', overflow: 'auto', width: '90%'
                }} onClick={e => e.stopPropagation()}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                        <h3 style={{margin: 0, color: '#051c2c'}}>Defect Density Details - {selectedMonth}</h3>
                        <button onClick={() => setShowDefectDensityModal(false)} style={{background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666'}}>×</button>
                    </div>
                    {defectDensityStatus.filtered.length === 0 ? (
                        <p style={{textAlign: 'center', color: '#666'}}>No Defect Density records found for this month.</p>
                    ) : (
                        <div style={{display: 'grid', gap: '15px'}}>
                            {defectDensityStatus.filtered.map((record, index) => {
                                const defects = Number(record.defects) || 0;
                                const testCases = Number(record.test_cases) || 0;
                                const density = record.defect_density_percentage || 0;
                                const statusColor = density >= 95 ? '#2ecc71' : density >= 90 ? '#f39c12' : '#e74c3c';
                                
                                return (
                                    <div key={index} style={{border: '1px solid #e0e0e0', borderRadius: '4px', padding: '15px', backgroundColor: '#f9f9f9'}}>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                            <div><strong>Axia ID:</strong> {record.axia_id}</div>
                                            <div><strong>Project:</strong> {record.project_name}</div>
                                            <div><strong>Defects:</strong> {defects}</div>
                                            <div><strong>Test Cases:</strong> {testCases}</div>
                                        </div>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px'}}>
                                            <div><strong>Defect Density:</strong> <span style={{color: statusColor, fontWeight: 'bold'}}>{density.toFixed(2)}%</span></div>
                                            <div><strong>Reported Date:</strong> {record.reported_date ? new Date(record.reported_date).toLocaleDateString() : 'N/A'}</div>
                                            <div><strong>Status:</strong> <span style={{color: statusColor, fontWeight: 'bold'}}>
                                                {density >= 95 ? 'Green' : density >= 90 ? 'Amber' : 'Red'}
                                            </span></div>
                                        </div>
                                        {record.comments && (
                                            <div style={{marginTop: '10px'}}><strong>Comments:</strong> {record.comments}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div style={{marginTop: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
                        <strong>Summary:</strong> {defectDensityStatus.count} defect density record{defectDensityStatus.count !== 1 ? 's' : ''} tracked. Average defect density: {defectDensityStatus.density}%
                    </div>
                </div>
            </div>
        )}

        {/* DEFECT DETECTION EFFICIENCY DETAILS MODAL */}
        {showDefectDetectionEfficiencyModal && (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
            }} onClick={() => setShowDefectDetectionEfficiencyModal(false)}>
                <div style={{
                    backgroundColor: 'white', padding: '20px', borderRadius: '8px', maxWidth: '1000px',
                    maxHeight: '80vh', overflow: 'auto', width: '90%'
                }} onClick={e => e.stopPropagation()}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                        <h3 style={{margin: 0, color: '#051c2c'}}>Defect Detection Efficiency Details - {selectedMonth}</h3>
                        <button onClick={() => setShowDefectDetectionEfficiencyModal(false)} style={{background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666'}}>×</button>
                    </div>
                    {defectDetectionEfficiencyStatus.filtered.length === 0 ? (
                        <p style={{textAlign: 'center', color: '#666'}}>No Defect Detection Efficiency records found for this month.</p>
                    ) : (
                        <div style={{display: 'grid', gap: '15px'}}>
                            {defectDetectionEfficiencyStatus.filtered.map((record, index) => {
                                const efficiency = record.defect_detection_efficiency_percentage || 0;
                                const statusColor = efficiency >= 90 ? '#2ecc71' : efficiency >= 80 ? '#f39c12' : '#e74c3c';
                                return (
                                    <div key={record.id || index} style={{
                                        border: '1px solid #ddd', borderRadius: '8px', padding: '15px',
                                        backgroundColor: '#f9f9f9'
                                    }}>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                            <div><strong>Axia ID:</strong> {record.axia_id}</div>
                                            <div><strong>Defects Found by Supplier (A):</strong> {record.defects_found_by_supplier}</div>
                                            <div><strong>Supplier Defects Rejected by CPChem (B):</strong> {record.supplier_defects_rejected_by_cpchem}</div>
                                        </div>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                            <div><strong>Defects Found by CPChem (C):</strong> {record.defects_found_by_cpchem}</div>
                                            <div><strong>Defects Rejected During UAT/Production (D):</strong> {record.defects_rejected_during_uat_production}</div>
                                            <div><strong>Defect Detection Efficiency:</strong> <span style={{color: statusColor, fontWeight: 'bold'}}>{efficiency.toFixed(2)}%</span></div>
                                        </div>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                            <div><strong>Reported Date:</strong> {record.reported_date ? new Date(record.reported_date).toLocaleDateString() : 'N/A'}</div>
                                            <div><strong>Formula:</strong> (A-B)/(C+D)</div>
                                        </div>
                                        {record.comment && (
                                            <div style={{marginTop: '10px'}}><strong>Comments:</strong> {record.comment}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div style={{marginTop: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
                        <strong>Summary:</strong> {defectDetectionEfficiencyStatus.count} defect detection efficiency record{defectDetectionEfficiencyStatus.count !== 1 ? 's' : ''} tracked. Average defect detection efficiency: {defectDetectionEfficiencyStatus.efficiency}%
                    </div>
                </div>
            </div>
        )}

        {/* DEFECT ESCAPES TO UAT DETAILS MODAL */}
        {showDefectEscapesToUATModal && (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
            }} onClick={() => setShowDefectEscapesToUATModal(false)}>
                <div style={{
                    backgroundColor: 'white', padding: '20px', borderRadius: '8px', maxWidth: '1000px',
                    maxHeight: '80vh', overflow: 'auto', width: '90%'
                }} onClick={e => e.stopPropagation()}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                        <h3 style={{margin: 0, color: '#051c2c'}}>Defect Escapes to UAT Details - {selectedMonth}</h3>
                        <button onClick={() => setShowDefectEscapesToUATModal(false)} style={{background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666'}}>×</button>
                    </div>
                    {defectEscapesToUATStatus.filtered.length === 0 ? (
                        <p style={{textAlign: 'center', color: '#666'}}>No defect escape records found for this month.</p>
                    ) : (
                        <div style={{display: 'grid', gap: '15px'}}>
                            {defectEscapesToUATStatus.filtered.map((record, index) => {
                                const A = Number(record.defects_found_by_cpchem) || 0;
                                const B = Number(record.defects_found_by_supplier) || 0;
                                const C = Number(record.defects_rejected_during_uat_production) || 0;
                                const denominator = B + C;
                                const escapeRate = denominator > 0 ? (A / denominator) * 100 : 0;
                                
                                let status = 'green';
                                if (escapeRate > 20) status = 'red';
                                else if (escapeRate > 10) status = 'amber';
                                const statusColor = status === 'green' ? '#2ecc71' : status === 'amber' ? '#f39c12' : '#e74c3c';

                                return (
                                    <div key={record.id || index} style={{
                                        border: '1px solid #ddd', borderRadius: '8px', padding: '15px',
                                        backgroundColor: '#f9f9f9'
                                    }}>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                            <div><strong>Axia ID:</strong> {record.axia_id}</div>
                                            <div><strong>Escape Rate:</strong> <span style={{color: statusColor, fontWeight: 'bold'}}>{escapeRate.toFixed(2)}%</span></div>
                                        </div>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                            <div><strong>Defects Escaped to SIT (A):</strong> {A}</div>
                                            <div><strong>SIT Defects by Supplier (B):</strong> {B}</div>
                                            <div><strong>UAT Defects Found (C):</strong> {C}</div>
                                        </div>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                                            <div><strong>Reported Date:</strong> {record.reported_date ? new Date(record.reported_date).toLocaleDateString() : 'N/A'}</div>
                                            <div><strong>Formula:</strong> A / (B + C)</div>
                                        </div>
                                        {record.comment && (
                                            <div style={{marginTop: '10px'}}><strong>Comments:</strong> {record.comment}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    
                    <div style={{marginTop: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
                        <strong>Summary:</strong> {defectEscapesToUATStatus.count} record{defectEscapesToUATStatus.count !== 1 ? 's' : ''} tracked. 
                        Overall Defect Escape Rate: {defectEscapesToUATStatus.escapesRate}%
                    </div>
                </div>
            </div>
        )}

    </div>
  );
  } catch (error) {
    console.error('Dashboard render error:', error);
    return (
      <div style={{padding: '20px', textAlign: 'center', color: '#666'}}>
        <h2>Dashboard Loading...</h2>
        <p>Please wait while we load your data.</p>
        <p style={{fontSize: '12px', color: '#999'}}>If this persists, try refreshing the page.</p>
      </div>
    );
  }
};

// 3. USER MANAGEMENT COMPONENT
const UserManagementView = ({ data, user, userRole, appId }) => {
  const { users } = data;
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState(USER_ROLES.DISPLAY_ONLY);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRoleUpdate = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS, userId), {
        role: newRole,
        updatedBy: user.uid,
        updatedAt: Timestamp.now()
      });
      
      // Log audit event
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.AUDIT_LOGS), {
        action: 'UPDATE_ROLE',
        collection: COLLECTIONS.USERS,
        recordId: userId,
        userId: user.uid,
        userEmail: user.email || 'anonymous',
        userRole: userRole,
        timestamp: Timestamp.now(),
        oldData: { role: selectedUser?.role },
        newData: { role: newRole }
      });
      
      setMsg('User role updated successfully!');
      setTimeout(() => setMsg(''), 3000);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error updating user role:', error);
      setMsg('Error updating user role: ' + error.message);
    }
  };

  const loadSampleUsers = async () => {
    setLoading(true);
    try {
      const sampleUsers = [
        {
          uid: 'sample-user-1',
          email: 'viewer@example.com',
          role: USER_ROLES.DISPLAY_ONLY,
          createdAt: Timestamp.now(),
          lastLogin: Timestamp.now()
        },
        {
          uid: 'sample-user-2',
          email: 'manager@example.com',
          role: USER_ROLES.PROJECT_MANAGER,
          createdAt: Timestamp.now(),
          lastLogin: Timestamp.now()
        },
        {
          uid: 'sample-user-3',
          email: 'admin@example.com',
          role: USER_ROLES.PROJECT_ADMIN,
          createdAt: Timestamp.now(),
          lastLogin: Timestamp.now()
        }
      ];

      const batch = writeBatch(db);
      for (const userData of sampleUsers) {
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS, userData.uid);
        batch.set(userRef, userData);
      }
      await batch.commit();

      setMsg('Sample users loaded successfully!');
      setTimeout(() => setMsg(''), 3000);
    } catch (error) {
      console.error('Error loading sample users:', error);
      setMsg('Error loading sample users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (userRole !== USER_ROLES.PROJECT_ADMIN) {
    return <div style={{padding:'20px', color:'#e74c3c'}}>Access denied. Project Admin role required.</div>;
  }

  return (
    <div style={{maxWidth: '1000px', margin: '0 auto', padding: '20px', fontFamily: 'Segoe UI, sans-serif'}}>
       <style>{styles}</style>
       <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
         <h2 style={{color: '#051c2c', margin:0}}>User Management</h2>
         <button onClick={loadSampleUsers} disabled={loading} style={{padding:'8px 16px', background:'#333', color:'#fff', border:'none', borderRadius:'4px', cursor: 'pointer'}}>
            {loading ? 'Loading...' : 'Load Sample Users'}
         </button>
       </div>
       
       {msg && <div style={{padding:'10px', background:'#d4edda', color:'#155724', borderRadius:'4px', marginBottom:'20px'}}>{msg}</div>}
       
       <div style={{overflowX:'auto'}}>
         <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
           <thead>
             <tr style={{backgroundColor:'#f5f5f5'}}>
               <th style={{padding:'12px', border:'1px solid #ddd', textAlign:'left'}}>Email</th>
               <th style={{padding:'12px', border:'1px solid #ddd', textAlign:'left'}}>Role</th>
               <th style={{padding:'12px', border:'1px solid #ddd', textAlign:'left'}}>Created</th>
               <th style={{padding:'12px', border:'1px solid #ddd', textAlign:'left'}}>Last Login</th>
               <th style={{padding:'12px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
             </tr>
           </thead>
           <tbody>
             {users.map((userRecord) => (
               <tr key={userRecord.id}>
                 <td style={{padding:'12px', border:'1px solid #ddd'}}>{userRecord.email || 'N/A'}</td>
                 <td style={{padding:'12px', border:'1px solid #ddd'}}>
                   <span style={{
                     color: userRecord.role === USER_ROLES.PROJECT_ADMIN ? '#e74c3c' :
                            userRecord.role === USER_ROLES.PROJECT_MANAGER ? '#f39c12' : '#3498db',
                     fontWeight: 'bold'
                   }}>
                     {userRecord.role === USER_ROLES.PROJECT_ADMIN ? 'Project Admin' :
                      userRecord.role === USER_ROLES.PROJECT_MANAGER ? 'Project Manager' : 'Display Only'}
                   </span>
                 </td>
                 <td style={{padding:'12px', border:'1px solid #ddd'}}>
                   {userRecord.createdAt ? new Date(userRecord.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                 </td>
                 <td style={{padding:'12px', border:'1px solid #ddd'}}>
                   {userRecord.lastLogin ? new Date(userRecord.lastLogin.toDate()).toLocaleDateString() : 'N/A'}
                 </td>
                 <td style={{padding:'12px', border:'1px solid #ddd'}}>
                   <button 
                     onClick={() => setSelectedUser(userRecord)}
                     style={{padding:'6px 12px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}
                   >
                     Change Role
                   </button>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>

       {selectedUser && (
         <div style={{marginTop:'20px', padding:'20px', background:'#f9f9f9', borderRadius:'4px'}}>
           <h3>Change Role for {selectedUser.email || 'User'}</h3>
           <div style={{marginBottom:'15px'}}>
             <label style={{display:'block', marginBottom:'5px'}}>New Role:</label>
             <select 
               value={newRole} 
               onChange={(e) => setNewRole(e.target.value)}
               style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}}
             >
               <option value={USER_ROLES.DISPLAY_ONLY}>Display Only</option>
               <option value={USER_ROLES.PROJECT_MANAGER}>Project Manager</option>
               <option value={USER_ROLES.PROJECT_ADMIN}>Project Admin</option>
             </select>
           </div>
           <div>
             <button 
               onClick={() => handleRoleUpdate(selectedUser.id, newRole)}
               style={{padding:'8px 16px', background:'#28a745', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', marginRight:'10px'}}
             >
               Update Role
             </button>
             <button 
               onClick={() => setSelectedUser(null)}
               style={{padding:'8px 16px', background:'#6c757d', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}
             >
               Cancel
             </button>
           </div>
         </div>
       )}
    </div>
  );
};

// 4. AUDIT LOGS COMPONENT
const AuditLogsView = ({ data, userRole }) => {
  const { auditLogs } = data;
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterDate, setFilterDate] = useState('');

  if (userRole !== USER_ROLES.PROJECT_ADMIN) {
    return <div style={{padding:'20px', color:'#e74c3c'}}>Access denied. Project Admin role required.</div>;
  }

  const filteredLogs = auditLogs.filter(log => {
    const matchesUser = !filterUser || log.userEmail?.toLowerCase().includes(filterUser.toLowerCase());
    const matchesAction = !filterAction || log.action === filterAction;
    const matchesDate = !filterDate || 
      (log.timestamp && new Date(log.timestamp.toDate()).toISOString().split('T')[0] === filterDate);
    return matchesUser && matchesAction && matchesDate;
  });

  return (
    <div style={{maxWidth: '1400px', margin: '0 auto', padding: '20px', fontFamily: 'Segoe UI, sans-serif'}}>
       <style>{styles}</style>
       <h2 style={{color: '#051c2c', marginBottom:'20px'}}>Audit Logs</h2>
       
       {/* Filters */}
       <div style={{display:'flex', gap:'15px', marginBottom:'20px', flexWrap:'wrap'}}>
         <div>
           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Filter by User:</label>
           <input 
             type="text" 
             placeholder="User email..." 
             value={filterUser}
             onChange={(e) => setFilterUser(e.target.value)}
             style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px', width:'200px'}}
           />
         </div>
         <div>
           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Filter by Action:</label>
           <select 
             value={filterAction}
             onChange={(e) => setFilterAction(e.target.value)}
             style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}}
           >
             <option value="">All Actions</option>
             <option value="CREATE">Create</option>
             <option value="UPDATE">Update</option>
             <option value="DELETE">Delete</option>
             <option value="UPDATE_ROLE">Update Role</option>
           </select>
         </div>
         <div>
           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Filter by Date:</label>
           <input 
             type="date" 
             value={filterDate}
             onChange={(e) => setFilterDate(e.target.value)}
             style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}}
           />
         </div>
         <div style={{display:'flex', alignItems:'end'}}>
           <button 
             onClick={() => {
               setFilterUser('');
               setFilterAction('');
               setFilterDate('');
             }}
             style={{padding:'8px 16px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}
           >
             Clear Filters
           </button>
         </div>
       </div>

       <div style={{overflowX:'auto'}}>
         <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
           <thead>
             <tr style={{backgroundColor:'#f5f5f5'}}>
               <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Timestamp</th>
               <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>User</th>
               <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Role</th>
               <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Action</th>
               <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Collection</th>
               <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Record ID</th>
               <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Details</th>
             </tr>
           </thead>
           <tbody>
             {filteredLogs.map((log, index) => (
               <tr key={index}>
                 <td style={{padding:'8px', border:'1px solid #ddd'}}>
                   {log.timestamp ? new Date(log.timestamp.toDate()).toLocaleString() : 'N/A'}
                 </td>
                 <td style={{padding:'8px', border:'1px solid #ddd'}}>{log.userEmail || 'N/A'}</td>
                 <td style={{padding:'8px', border:'1px solid #ddd'}}>
                   <span style={{
                     color: log.userRole === USER_ROLES.PROJECT_ADMIN ? '#e74c3c' :
                            log.userRole === USER_ROLES.PROJECT_MANAGER ? '#f39c12' : '#3498db',
                     fontWeight: 'bold'
                   }}>
                     {log.userRole === USER_ROLES.PROJECT_ADMIN ? 'Admin' :
                      log.userRole === USER_ROLES.PROJECT_MANAGER ? 'Manager' : 'Viewer'}
                   </span>
                 </td>
                 <td style={{padding:'8px', border:'1px solid #ddd'}}>
                   <span style={{
                     color: log.action === 'DELETE' ? '#e74c3c' :
                            log.action === 'CREATE' ? '#28a745' : '#00a3e0',
                     fontWeight: 'bold'
                   }}>
                     {log.action}
                   </span>
                 </td>
                 <td style={{padding:'8px', border:'1px solid #ddd'}}>{log.collection}</td>
                 <td style={{padding:'8px', border:'1px solid #ddd', fontFamily:'monospace', fontSize:'12px'}}>
                   {log.recordId ? log.recordId.substring(0, 8) + '...' : 'N/A'}
                 </td>
                 <td style={{padding:'8px', border:'1px solid #ddd'}}>
                   {log.oldData && log.newData && (
                     <details>
                       <summary style={{cursor:'pointer', fontSize:'12px'}}>View Changes</summary>
                       <div style={{marginTop:'5px', fontSize:'11px', fontFamily:'monospace'}}>
                         <div><strong>Before:</strong> {JSON.stringify(log.oldData, null, 2)}</div>
                         <div><strong>After:</strong> {JSON.stringify(log.newData, null, 2)}</div>
                       </div>
                     </details>
                   )}
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
       
       {filteredLogs.length === 0 && (
         <div style={{textAlign:'center', padding:'40px', color:'#666'}}>
           No audit logs found matching the current filters.
         </div>
       )}
    </div>
  );
};

// 1. LOGIN COMPONENT
const LoginView = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Check if user exists
    const user = PREDEFINED_USERS[username.toLowerCase()];
    if (!user) {
      setError('Invalid username');
      setLoading(false);
      return;
    }

    // Check password
    if (user.password !== password) {
      setError('Invalid password');
      setLoading(false);
      return;
    }

    // Successful login
    const userProfile = {
      uid: username,
      email: user.email,
      role: user.role,
      name: user.name,
      lastLogin: Timestamp.now()
    };

    onLogin(userProfile);
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #051c2c 0%, #00a3e0 100%)',
      fontFamily: 'Segoe UI, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{textAlign: 'center', marginBottom: '30px'}}>
          <div style={{
            fontSize: '48px',
            color: '#051c2c',
            marginBottom: '10px'
          }}>
            <LucideIcons.LayoutGrid />
          </div>
          <h1 style={{
            color: '#051c2c',
            margin: '0',
            fontSize: '28px',
            fontWeight: 'bold'
          }}>
            SquadOps
          </h1>
          <p style={{
            color: '#666',
            margin: '5px 0 0 0',
            fontSize: '14px'
          }}>
            Squad Execution Governance
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{marginBottom: '20px'}}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#333',
              fontWeight: '500'
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username (display/manager/admin)"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          <div style={{marginBottom: '20px'}}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#333',
              fontWeight: '500'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          {error && (
            <div style={{
              background: '#fee',
              color: '#c33',
              padding: '10px',
              borderRadius: '4px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: '#00a3e0',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: '#f8f9fa',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          <h4 style={{margin: '0 0 10px 0', color: '#051c2c'}}>Demo Accounts:</h4>
          <div style={{marginBottom: '8px'}}>
            <strong>Display:</strong> D
          </div>
          <div style={{marginBottom: '8px'}}>
            <strong>Manager:</strong> M
          </div>
          <div>
            <strong>Admin:</strong> A
          </div>
        </div>
      </div>
    </div>
  );
};

// 1.5 FINANCIAL SUMMARY COMPONENT
const FinancialSummaryView = ({ data, userRole }) => {
  const { project_financials, projects } = data;
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // Current month

  // Aggregate financial data by project
  const projectFinancialSummary = useMemo(() => {
    const summary = {};
    
    project_financials.forEach(record => {
      if (!record.monthly_actual_date || !record.monthly_actual_date.startsWith(selectedMonth)) return;
      
      const axiaId = record.axia_id;
      const forecast = Number(record.monthly_forecast_amount) || 0;
      const actual = Number(record.monthly_actual_amount) || 0;
      
      if (!summary[axiaId]) {
        summary[axiaId] = {
          totalForecast: 0,
          totalActual: 0,
          suppliers: 0,
          records: []
        };
      }
      
      summary[axiaId].totalForecast += forecast;
      summary[axiaId].totalActual += actual;
      summary[axiaId].suppliers += 1;
      summary[axiaId].records.push(record);
    });
    
    // Calculate accuracy and status for each project
    Object.keys(summary).forEach(axiaId => {
      const { totalForecast, totalActual } = summary[axiaId];
      if (totalForecast === 0) {
        summary[axiaId].accuracy = 0;
        summary[axiaId].variance = 0;
      } else {
        summary[axiaId].variance = ((totalForecast - totalActual) / totalForecast) * 100;
        summary[axiaId].accuracy = Math.max(0, 100 - Math.abs(summary[axiaId].variance));
      }
      
      // Status based on accuracy
      if (summary[axiaId].accuracy >= 90) summary[axiaId].status = 'green';
      else if (summary[axiaId].accuracy >= 80) summary[axiaId].status = 'amber';
      else summary[axiaId].status = 'red';
    });
    
    return summary;
  }, [project_financials, selectedMonth]);

  const getProjectName = (axiaId) => {
    const project = projects.find(p => p.project_id === axiaId);
    return project ? `${project.project_name}` : axiaId;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'green': return '#2ecc71';
      case 'amber': return '#f39c12';
      case 'red': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  return (
    <div style={{padding: '20px'}}>
      <h2 style={{color: '#051c2c', marginBottom: '20px'}}>Project Financial Summary</h2>
      
      <div style={{marginBottom: '20px'}}>
        <label style={{fontSize: '14px', marginRight: '10px'}}>Select Month:</label>
        <input 
          type="month" 
          value={selectedMonth} 
          onChange={e => setSelectedMonth(e.target.value)}
          style={{padding: '5px', border: '1px solid #ccc', borderRadius: '4px'}}
        />
      </div>

      {Object.keys(projectFinancialSummary).length === 0 ? (
        <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>
          <h3>No Financial Data</h3>
          <p>No project financial records found for {selectedMonth}.</p>
        </div>
      ) : (
        <div style={{display: 'grid', gap: '20px'}}>
          {Object.entries(projectFinancialSummary)
            .sort(([,a], [,b]) => b.accuracy - a.accuracy) // Sort by accuracy descending
            .map(([axiaId, summary]) => (
            <div key={axiaId} style={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                <h3 style={{margin: 0, color: '#051c2c'}}>
                  {axiaId} - {getProjectName(axiaId)}
                </h3>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(summary.status)
                }}></div>
              </div>
              
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px'}}>
                <div style={{textAlign: 'center'}}>
                  <div style={{fontSize: '24px', fontWeight: 'bold', color: '#051c2c'}}>
                    ${summary.totalForecast.toLocaleString()}
                  </div>
                  <div style={{fontSize: '12px', color: '#666'}}>Total Forecast</div>
                </div>
                <div style={{textAlign: 'center'}}>
                  <div style={{fontSize: '24px', fontWeight: 'bold', color: '#051c2c'}}>
                    ${summary.totalActual.toLocaleString()}
                  </div>
                  <div style={{fontSize: '12px', color: '#666'}}>Total Actual</div>
                </div>
                <div style={{textAlign: 'center'}}>
                  <div style={{
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    color: summary.variance >= 0 ? '#2ecc71' : '#e74c3c'
                  }}>
                    {summary.variance >= 0 ? '+' : ''}{summary.variance.toFixed(1)}%
                  </div>
                  <div style={{fontSize: '12px', color: '#666'}}>Variance</div>
                </div>
                <div style={{textAlign: 'center'}}>
                  <div style={{
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    color: getStatusColor(summary.status)
                  }}>
                    {summary.accuracy.toFixed(1)}%
                  </div>
                  <div style={{fontSize: '12px', color: '#666'}}>Accuracy</div>
                </div>
              </div>
              
              <div style={{marginBottom: '15px'}}>
                <strong>Supplier Breakdown ({summary.suppliers} supplier{summary.suppliers !== 1 ? 's' : ''}):</strong>
              </div>
              
              <div style={{display: 'grid', gap: '10px'}}>
                {summary.records.map((record, index) => {
                  const forecast = Number(record.monthly_forecast_amount) || 0;
                  const actual = Number(record.monthly_actual_amount) || 0;
                  const variance = forecast > 0 ? ((forecast - actual) / forecast) * 100 : 0;
                  
                  return (
                    <div key={index} style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr',
                      gap: '10px',
                      padding: '10px',
                      backgroundColor: '#f9f9f9',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}>
                      <div><strong>{record.supplier_name}</strong></div>
                      <div>${forecast.toLocaleString()}</div>
                      <div>${actual.toLocaleString()}</div>
                      <div style={{
                        color: Math.abs(variance) > 20 ? '#e74c3c' : Math.abs(variance) > 10 ? '#f39c12' : '#2ecc71',
                        fontWeight: 'bold'
                      }}>
                        {variance.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 2. DATA ENTRY COMPONENT
const DataEntryView = ({ appId, refreshTrigger, data, user, userRole, logAuditEvent, selectedMonth }) => {
  const { 
    resources, timesheets, agile, slas, financials, milestones,
    projects, master_resources, skills, organizational_units, roles, locations,
    resource_skills, resource_projects, rfc_tracking, project_cost_estimation, project_financials, defect_density,
    defect_detection_efficiency
  } = data;
  const [activeTab, setActiveTab] = useState('timesheets');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const [tsForm, setTsForm] = useState({ week: '', core: '', flex: '' });
  const [agileForm, setAgileForm] = useState({ sprint: '', sp: '', status: 'Done', type: 'Story' });
  const [finForm, setFinForm] = useState({ month: '', cap: '', demand: '' });
  const [milestoneForm, setMilestoneForm] = useState({
    axiaId: '', axiaName: '', axiaOwnerCpc: '', axiaMilestone: '', axiaMilestoneDescription: '',
    axiaMilestoneObjective: '', axiaMilestoneDueDate: '', axiaMilestoneOwnerLtim: '',
    axiaMilestoneStatus: '', axiaMilestoneStatusDescription: '', axiaMilestoneStatusDate: ''
  });

  // Master Data Forms
  const [projectForm, setProjectForm] = useState({
    project_id: '', project_name: '', project_status: 'In Progress', start_date: '', 
    target_end_date: '', budget_code: '', project_manager_id: '', org_unit_id: '',
    actual_kickoff_date: '', actual_completed_date: ''
  });
  const [masterResourceForm, setMasterResourceForm] = useState({
    resource_id: '', first_name: '', last_name: '', email_address: '', primary_role: '',
    is_full_time: true, onboarding_date: '', manager_id: '', org_unit_id: '',
    location: 'Onsite', allocation: 'Core', status: 'Active', offboarding_date: ''
  });
  const [skillForm, setSkillForm] = useState({
    skill_id: '', skill_name: '', skill_category: '', is_critical: false, date_created: ''
  });
  const [orgUnitForm, setOrgUnitForm] = useState({
    org_unit_id: '', unit_name: '', parent_unit_id: '', unit_type: '', cost_center_code: ''
  });
  const [roleForm, setRoleForm] = useState({
    role_id: '', role_name: '', role_description: '', role_family: '', required_level: 1
  });
  const [locationForm, setLocationForm] = useState({
    location_id: '', location_name: '', city: '', country: '', time_zone: '', is_physical_office: true
  });
  
  // Junction Table Forms
  const [resourceSkillForm, setResourceSkillForm] = useState({
    resource_id: '', skill_id: '', proficiency_level: 1, years_of_experience: 0, last_verified_date: ''
  });
  const [resourceProjectForm, setResourceProjectForm] = useState({
    resource_id: '', project_id: '', assignment_start_date: '', assignment_end_date: '',
    role_on_project: '', allocated_capacity_pct: 100, is_flex_resource: false
  });
  const [rfcForm, setRfcForm] = useState({
    axia_id: '', base_requirements_count: 0, base_requirements_lock_date: '',
    base_requirements_details: '', delta_requirements_count: 0, delta_requirements_lock_date: '', delta_requirements_details: ''
  });
  const [projectCostForm, setProjectCostForm] = useState({
    axia_id: '', estimation_requested_date: '', estimation_submitted_date: '',
    completed_within_sla: 'Yes', primary_contact: '', estimated_effort_hours: '', duration_months: '', document_link: ''
  });
  const [projectFinancialForm, setProjectFinancialForm] = useState({
    axia_id: '', supplier_name: '', monthly_forecast_amount: '', monthly_forecast_date: '',
    monthly_actual_amount: '', monthly_actual_date: '', comment: ''
  });
  const [defectDensityForm, setDefectDensityForm] = useState({
    axia_id: '', warranty_period_start_date: '', warranty_period_end_date: '',
    defects_reported_during_warranty: '', test_cases_during_warranty: '', defect_density_percentage: '',
    reported_date: '', comment: ''
  });
  const [defectDetectionEfficiencyForm, setDefectDetectionEfficiencyForm] = useState({
    axia_id: '', defects_found_by_supplier: '', supplier_defects_rejected_by_cpchem: '',
    defects_found_by_cpchem: '', defects_rejected_during_uat_production: '', reported_date: '', comment: ''
  });

  const [editMode, setEditMode] = useState({ type: null, id: null }); // Track which record is being edited
  const [viewMode, setViewMode] = useState(selectedMonth ? 'view' : 'add'); // 'add' or 'view'
  const [viewTab, setViewTab] = useState(selectedMonth ? 'defect_density' : 'timesheets'); // Active tab in view mode
  const [searchTerm, setSearchTerm] = useState(''); // Search term
  
  // CSV Upload state
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [filterMonth, setFilterMonth] = useState(selectedMonth ? selectedMonth.split('-')[1] : ''); // Month filter
  const [filterYear, setFilterYear] = useState(selectedMonth ? selectedMonth.split('-')[0] : ''); // Year filter
  const [filterWeek, setFilterWeek] = useState(''); // Week filter

  const handleSubmit = async (e, type) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isEdit = editMode.type === type && editMode.id;
      
      if (type === 'timesheets') {
        const data = {
          week: tsForm.week,
          coreHours: Number(tsForm.core),
          flexHours: Number(tsForm.flex),
          employeeId: 'AGGREGATE',
          createdAt: isEdit ? tsForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.TIMESHEETS, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.TIMESHEETS, editMode.id, tsForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.TIMESHEETS), data);
          await logAuditEvent('CREATE', COLLECTIONS.TIMESHEETS, docRef.id, null, data);
        }
      } else if (type === 'agile') {
        const data = {
          sprint: agileForm.sprint,
          storyPoints: Number(agileForm.sp),
          status: agileForm.status,
          type: agileForm.type,
          createdAt: isEdit ? agileForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.AGILE, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.AGILE, editMode.id, agileForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.AGILE), data);
          await logAuditEvent('CREATE', COLLECTIONS.AGILE, docRef.id, null, data);
        }
      } else if (type === 'financials') {
        const data = {
          month: finForm.month,
          capacity: Number(finForm.cap),
          demand: Number(finForm.demand),
          budget: 250000,
          createdAt: isEdit ? finForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FINANCIALS, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.FINANCIALS, editMode.id, finForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FINANCIALS), data);
          await logAuditEvent('CREATE', COLLECTIONS.FINANCIALS, docRef.id, null, data);
        }
      } else if (type === 'milestones') {
        const data = {
          axiaId: milestoneForm.axiaId,
          axiaName: milestoneForm.axiaName,
          axiaOwnerCpc: milestoneForm.axiaOwnerCpc,
          axiaMilestone: milestoneForm.axiaMilestone,
          axiaMilestoneDescription: milestoneForm.axiaMilestoneDescription,
          axiaMilestoneObjective: milestoneForm.axiaMilestoneObjective,
          axiaMilestoneDueDate: milestoneForm.axiaMilestoneDueDate,
          axiaMilestoneOwnerLtim: milestoneForm.axiaMilestoneOwnerLtim,
          axiaMilestoneStatus: milestoneForm.axiaMilestoneStatus,
          axiaMilestoneStatusDescription: milestoneForm.axiaMilestoneStatusDescription,
          axiaMilestoneStatusDate: milestoneForm.axiaMilestoneStatusDate,
          createdAt: isEdit ? milestoneForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.MILESTONES, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.MILESTONES, editMode.id, milestoneForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.MILESTONES), data);
          await logAuditEvent('CREATE', COLLECTIONS.MILESTONES, docRef.id, null, data);
        }
      } else if (type === 'projects') {
        const data = {
          project_id: projectForm.project_id,
          project_name: projectForm.project_name,
          project_status: projectForm.project_status,
          start_date: projectForm.start_date,
          target_end_date: projectForm.target_end_date,
          budget_code: projectForm.budget_code,
          project_manager_id: projectForm.project_manager_id,
          org_unit_id: projectForm.org_unit_id,
          createdAt: isEdit ? projectForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.PROJECTS, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.PROJECTS, editMode.id, projectForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.PROJECTS), data);
          await logAuditEvent('CREATE', COLLECTIONS.PROJECTS, docRef.id, null, data);
        }
      } else if (type === 'master_resources') {
        const data = {
          resource_id: masterResourceForm.resource_id,
          first_name: masterResourceForm.first_name,
          last_name: masterResourceForm.last_name,
          email_address: masterResourceForm.email_address,
          primary_role: masterResourceForm.primary_role,
          is_full_time: masterResourceForm.is_full_time,
          onboarding_date: masterResourceForm.onboarding_date,
          manager_id: masterResourceForm.manager_id,
          org_unit_id: masterResourceForm.org_unit_id,
          location: masterResourceForm.location,
          allocation: masterResourceForm.allocation,
          status: masterResourceForm.status,
          offboarding_date: masterResourceForm.offboarding_date,
          createdAt: isEdit ? masterResourceForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.MASTER_RESOURCES, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.MASTER_RESOURCES, editMode.id, masterResourceForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.MASTER_RESOURCES), data);
          await logAuditEvent('CREATE', COLLECTIONS.MASTER_RESOURCES, docRef.id, null, data);
        }
      } else if (type === 'skills') {
        const data = {
          skill_id: skillForm.skill_id,
          skill_name: skillForm.skill_name,
          skill_category: skillForm.skill_category,
          is_critical: skillForm.is_critical,
          date_created: isEdit ? skillForm.date_created : Timestamp.now(),
          createdAt: isEdit ? skillForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.SKILLS, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.SKILLS, editMode.id, skillForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.SKILLS), data);
          await logAuditEvent('CREATE', COLLECTIONS.SKILLS, docRef.id, null, data);
        }
      } else if (type === 'organizational_units') {
        const data = {
          org_unit_id: orgUnitForm.org_unit_id,
          unit_name: orgUnitForm.unit_name,
          parent_unit_id: orgUnitForm.parent_unit_id,
          unit_type: orgUnitForm.unit_type,
          cost_center_code: orgUnitForm.cost_center_code,
          createdAt: isEdit ? orgUnitForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.ORG_UNITS, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.ORG_UNITS, editMode.id, orgUnitForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.ORG_UNITS), data);
          await logAuditEvent('CREATE', COLLECTIONS.ORG_UNITS, docRef.id, null, data);
        }
      } else if (type === 'roles') {
        const data = {
          role_id: roleForm.role_id,
          role_name: roleForm.role_name,
          role_description: roleForm.role_description,
          role_family: roleForm.role_family,
          required_level: Number(roleForm.required_level),
          createdAt: isEdit ? roleForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.ROLES, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.ROLES, editMode.id, roleForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.ROLES), data);
          await logAuditEvent('CREATE', COLLECTIONS.ROLES, docRef.id, null, data);
        }
      } else if (type === 'locations') {
        const data = {
          location_id: locationForm.location_id,
          location_name: locationForm.location_name,
          city: locationForm.city,
          country: locationForm.country,
          time_zone: locationForm.time_zone,
          is_physical_office: locationForm.is_physical_office,
          createdAt: isEdit ? locationForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.LOCATIONS, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.LOCATIONS, editMode.id, locationForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.LOCATIONS), data);
          await logAuditEvent('CREATE', COLLECTIONS.LOCATIONS, docRef.id, null, data);
        }
      } else if (type === 'resource_skills') {
        const data = {
          resource_id: resourceSkillForm.resource_id,
          skill_id: resourceSkillForm.skill_id,
          proficiency_level: Number(resourceSkillForm.proficiency_level),
          years_of_experience: Number(resourceSkillForm.years_of_experience),
          last_verified_date: resourceSkillForm.last_verified_date,
          createdAt: isEdit ? resourceSkillForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.RESOURCE_SKILLS, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.RESOURCE_SKILLS, editMode.id, resourceSkillForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.RESOURCE_SKILLS), data);
          await logAuditEvent('CREATE', COLLECTIONS.RESOURCE_SKILLS, docRef.id, null, data);
        }
      } else if (type === 'resource_projects') {
        const data = {
          resource_id: resourceProjectForm.resource_id,
          project_id: resourceProjectForm.project_id,
          assignment_start_date: resourceProjectForm.assignment_start_date,
          assignment_end_date: resourceProjectForm.assignment_end_date,
          role_on_project: resourceProjectForm.role_on_project,
          allocated_capacity_pct: Number(resourceProjectForm.allocated_capacity_pct),
          is_flex_resource: resourceProjectForm.is_flex_resource,
          createdAt: isEdit ? resourceProjectForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.RESOURCE_PROJECTS, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.RESOURCE_PROJECTS, editMode.id, resourceProjectForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.RESOURCE_PROJECTS), data);
          await logAuditEvent('CREATE', COLLECTIONS.RESOURCE_PROJECTS, docRef.id, null, data);
        }
      } else if (type === 'rfc_tracking') {
        const data = {
          axia_id: rfcForm.axia_id,
          base_requirements_count: Number(rfcForm.base_requirements_count),
          base_requirements_lock_date: rfcForm.base_requirements_lock_date,
          base_requirements_details: rfcForm.base_requirements_details,
          delta_requirements_count: Number(rfcForm.delta_requirements_count),
          delta_requirements_lock_date: rfcForm.delta_requirements_lock_date,
          delta_requirements_details: rfcForm.delta_requirements_details,
          createdAt: isEdit ? rfcForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.RFC_TRACKING, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.RFC_TRACKING, editMode.id, rfcForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.RFC_TRACKING), data);
          await logAuditEvent('CREATE', COLLECTIONS.RFC_TRACKING, docRef.id, null, data);
        }
      } else if (type === 'project_cost_estimation') {
        const data = {
          axia_id: projectCostForm.axia_id,
          estimation_requested_date: projectCostForm.estimation_requested_date,
          estimation_submitted_date: projectCostForm.estimation_submitted_date,
          completed_within_sla: projectCostForm.completed_within_sla,
          primary_contact: projectCostForm.primary_contact,
          estimated_effort_hours: Number(projectCostForm.estimated_effort_hours),
          duration_months: Number(projectCostForm.duration_months),
          document_link: projectCostForm.document_link,
          createdAt: isEdit ? projectCostForm.createdAt : Timestamp.now()
        };
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.PROJECT_COST_ESTIMATION, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.PROJECT_COST_ESTIMATION, editMode.id, projectCostForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.PROJECT_COST_ESTIMATION), data);
          await logAuditEvent('CREATE', COLLECTIONS.PROJECT_COST_ESTIMATION, docRef.id, null, data);
        }
      } else if (type === 'project_financials') {
        const data = {
          axia_id: projectFinancialForm.axia_id,
          supplier_name: projectFinancialForm.supplier_name,
          monthly_forecast_amount: Number(projectFinancialForm.monthly_forecast_amount),
          monthly_forecast_date: projectFinancialForm.monthly_forecast_date,
          monthly_actual_amount: Number(projectFinancialForm.monthly_actual_amount),
          monthly_actual_date: projectFinancialForm.monthly_actual_date,
          comment: projectFinancialForm.comment,
          createdAt: isEdit ? projectFinancialForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.PROJECT_FINANCIALS, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.PROJECT_FINANCIALS, editMode.id, projectFinancialForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.PROJECT_FINANCIALS), data);
          await logAuditEvent('CREATE', COLLECTIONS.PROJECT_FINANCIALS, docRef.id, null, data);
        }
      } else if (type === 'defect_density') {
        // Calculate defect density: 1 - (A - B) where A = defects, B = test cases
        const defects = Number(defectDensityForm.defects_reported_during_warranty) || 0;
        const testCases = Number(defectDensityForm.test_cases_during_warranty) || 0;
        const defectDensity = testCases > 0 ? 1 - (defects - testCases) : 0;
        
        const data = {
          axia_id: defectDensityForm.axia_id,
          warranty_period_start_date: defectDensityForm.warranty_period_start_date,
          warranty_period_end_date: defectDensityForm.warranty_period_end_date,
          defects_reported_during_warranty: defects,
          test_cases_during_warranty: testCases,
          defect_density_percentage: defectDensity,
          reported_date: defectDensityForm.reported_date,
          comment: defectDensityForm.comment,
          createdAt: isEdit ? defectDensityForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEFECT_DENSITY, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.DEFECT_DENSITY, editMode.id, defectDensityForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEFECT_DENSITY), data);
          await logAuditEvent('CREATE', COLLECTIONS.DEFECT_DENSITY, docRef.id, null, data);
        }
      } else if (type === 'defect_detection_efficiency') {
        // Calculate defect detection efficiency: (A - B) / (C + D)
        const A = Number(defectDetectionEfficiencyForm.defects_found_by_supplier) || 0;
        const B = Number(defectDetectionEfficiencyForm.supplier_defects_rejected_by_cpchem) || 0;
        const C = Number(defectDetectionEfficiencyForm.defects_found_by_cpchem) || 0;
        const D = Number(defectDetectionEfficiencyForm.defects_rejected_during_uat_production) || 0;
        const defectDetectionEfficiency = (C + D) > 0 ? (A - B) / (C + D) : 0;
        
        const data = {
          axia_id: defectDetectionEfficiencyForm.axia_id,
          defects_found_by_supplier: A,
          supplier_defects_rejected_by_cpchem: B,
          defects_found_by_cpchem: C,
          defects_rejected_during_uat_production: D,
          defect_detection_efficiency_percentage: defectDetectionEfficiency,
          reported_date: defectDetectionEfficiencyForm.reported_date,
          comment: defectDetectionEfficiencyForm.comment,
          createdAt: isEdit ? defectDetectionEfficiencyForm.createdAt : Timestamp.now()
        };
        
        if (isEdit) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEFECT_DETECTION_EFFICIENCY, editMode.id), data);
          await logAuditEvent('UPDATE', COLLECTIONS.DEFECT_DETECTION_EFFICIENCY, editMode.id, defectDetectionEfficiencyForm, data);
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEFECT_DETECTION_EFFICIENCY), data);
          await logAuditEvent('CREATE', COLLECTIONS.DEFECT_DETECTION_EFFICIENCY, docRef.id, null, data);
        }
      }
      
      setMsg(isEdit ? 'Data updated successfully!' : 'Data saved successfully!');
      setTimeout(() => setMsg(''), 3000);
      refreshTrigger();
      
      // Reset edit mode and forms
      setEditMode({ type: null, id: null });
      if (type === 'timesheets') setTsForm({ week: '', core: '', flex: '' });
      else if (type === 'agile') setAgileForm({ sprint: '', sp: '', status: 'Done', type: 'Story' });
      else if (type === 'financials') setFinForm({ month: '', cap: '', demand: '' });
      else if (type === 'milestones') setMilestoneForm({
        axiaId: '', axiaName: '', axiaOwnerCpc: '', axiaMilestone: '', axiaMilestoneDescription: '',
        axiaMilestoneObjective: '', axiaMilestoneDueDate: '', axiaMilestoneOwnerLtim: '',
        axiaMilestoneStatus: '', axiaMilestoneStatusDescription: '', axiaMilestoneStatusDate: ''
      });
      else if (type === 'projects') setProjectForm({
        project_id: '', project_name: '', project_status: 'In Progress', start_date: '', 
        target_end_date: '', budget_code: '', project_manager_id: '', org_unit_id: ''
      });
      else if (type === 'master_resources') setMasterResourceForm({
        resource_id: '', first_name: '', last_name: '', email_address: '', primary_role: '',
        is_full_time: true, onboarding_date: '', manager_id: '', org_unit_id: '',
        location: 'Onsite', allocation: 'Core', status: 'Active', offboarding_date: ''
      });
      else if (type === 'skills') setSkillForm({
        skill_id: '', skill_name: '', skill_category: '', is_critical: false, date_created: ''
      });
      else if (type === 'organizational_units') setOrgUnitForm({
        org_unit_id: '', unit_name: '', parent_unit_id: '', unit_type: '', cost_center_code: ''
      });
      else if (type === 'roles') setRoleForm({
        role_id: '', role_name: '', role_description: '', role_family: '', required_level: 1
      });
      else if (type === 'locations') setLocationForm({
        location_id: '', location_name: '', city: '', country: '', time_zone: '', is_physical_office: true
      });
      else if (type === 'resource_skills') setResourceSkillForm({
        resource_id: '', skill_id: '', proficiency_level: 1, years_of_experience: 0, last_verified_date: ''
      });
      else if (type === 'resource_projects') setResourceProjectForm({
        resource_id: '', project_id: '', assignment_start_date: '', assignment_end_date: '',
        role_on_project: '', allocated_capacity_pct: 100, is_flex_resource: false
      });
      else if (type === 'rfc_tracking') setRfcForm({
        axia_id: '', base_requirements_count: 0, base_requirements_lock_date: '',
        delta_requirements_count: 0, delta_requirements_lock_date: '', delta_requirements_details: ''
      });
      else if (type === 'project_cost_estimation') setProjectCostForm({
        axia_id: '', estimation_requested_date: '', estimation_submitted_date: '',
        completed_within_sla: 'Yes', primary_contact: '', estimated_effort_hours: '', duration_months: ''
        , document_link: ''
      });
      else if (type === 'project_financials') setProjectFinancialForm({
        axia_id: '', supplier_name: '', monthly_forecast_amount: '', monthly_forecast_date: '',
        monthly_actual_amount: '', monthly_actual_date: '', comment: ''
      });
      else if (type === 'defect_density') setDefectDensityForm({
        axia_id: '', warranty_period_start_date: '', warranty_period_end_date: '',
        defects_reported_during_warranty: '', test_cases_during_warranty: '', defect_density_percentage: '',
        reported_date: '', comment: ''
      });
      else if (type === 'defect_detection_efficiency') setDefectDetectionEfficiencyForm({
        axia_id: '', defects_found_by_supplier: '', supplier_defects_rejected_by_cpchem: '',
        defects_found_by_cpchem: '', defects_rejected_during_uat_production: '', reported_date: '', comment: ''
      });
    } catch (err) {
      console.error(err);
      setMsg('Error saving: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // CSV Upload Handlers
  const handleCSVUpload = async (type, rows, expectedFields) => {
    setUploadLoading(true);
    setUploadMsg(`Uploading ${rows.length} ${type} records...`);
    
    try {
      const batch = writeBatch(db);
      let successCount = 0;
      let errorCount = 0;
      
      for (const row of rows) {
        try {
          // Validate required fields
          const missingFields = expectedFields.filter(field => !row[field] || row[field].trim() === '');
          if (missingFields.length > 0) {
            console.warn(`Skipping row due to missing fields: ${missingFields.join(', ')}`, row);
            errorCount++;
            continue;
          }
          
          // Transform data based on type
          let data = { ...row };
          
          // Convert string dates to timestamps if needed
          if (data.last_verified_date) data.last_verified_date = new Date(data.last_verified_date).toISOString();
          if (data.assignment_start_date) data.assignment_start_date = new Date(data.assignment_start_date).toISOString();
          if (data.assignment_end_date) data.assignment_end_date = new Date(data.assignment_end_date).toISOString();
          if (data.axiaMilestoneDueDate) data.axiaMilestoneDueDate = new Date(data.axiaMilestoneDueDate).toISOString();
          if (data.axiaMilestoneStatusDate) data.axiaMilestoneStatusDate = new Date(data.axiaMilestoneStatusDate).toISOString();
          if (data.start_date) data.start_date = new Date(data.start_date).toISOString();
          if (data.target_end_date) data.target_end_date = new Date(data.target_end_date).toISOString();
          if (data.actual_kickoff_date && data.actual_kickoff_date !== '') data.actual_kickoff_date = new Date(data.actual_kickoff_date).toISOString();
          if (data.base_requirements_lock_date) data.base_requirements_lock_date = new Date(data.base_requirements_lock_date).toISOString();
          if (data.delta_requirements_lock_date) data.delta_requirements_lock_date = new Date(data.delta_requirements_lock_date).toISOString();
          if (data.estimation_requested_date) data.estimation_requested_date = new Date(data.estimation_requested_date).toISOString();
          if (data.estimation_submitted_date) data.estimation_submitted_date = new Date(data.estimation_submitted_date).toISOString();
          
          // Convert string booleans
          if (data.is_critical !== undefined) data.is_critical = data.is_critical.toLowerCase() === 'true';
          if (data.is_flex_resource !== undefined) data.is_flex_resource = data.is_flex_resource.toLowerCase() === 'true';
          if (data.is_full_time !== undefined) data.is_full_time = data.is_full_time.toLowerCase() === 'true';
          if (data.is_physical_office !== undefined) data.is_physical_office = data.is_physical_office.toLowerCase() === 'true';
          
          // Convert string numbers
          if (data.proficiency_level) data.proficiency_level = parseInt(data.proficiency_level);
          if (data.years_of_experience) data.years_of_experience = parseInt(data.years_of_experience);
          if (data.allocated_capacity_pct) data.allocated_capacity_pct = parseInt(data.allocated_capacity_pct);
          if (data.required_level) data.required_level = parseInt(data.required_level);
          if (data.estimated_effort_hours) data.estimated_effort_hours = parseFloat(data.estimated_effort_hours);
          if (data.duration_months) data.duration_months = parseFloat(data.duration_months);
          
          const collectionName = COLLECTIONS[type.toUpperCase()];
          const docRef = doc(collection(db, 'artifacts', appId, 'public', 'data', collectionName));
          batch.set(docRef, data);
          successCount++;
          
          // Log audit event
          await logAuditEvent('CREATE', collectionName, docRef.id, null, data);
          
        } catch (rowError) {
          console.error('Error processing row:', row, rowError);
          errorCount++;
        }
      }
      
      await batch.commit();
      setUploadMsg(`Upload complete! ${successCount} records added successfully. ${errorCount} records failed.`);
      refreshTrigger();
      
    } catch (err) {
      console.error(err);
      setUploadMsg('Upload failed: ' + err.message);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleEdit = (type, record, id) => {
    setEditMode({ type, id });
    setViewMode('add'); // Switch to add mode to show the form
    
    if (type === 'timesheets') {
      setTsForm({
        week: record.week,
        core: record.coreHours,
        flex: record.flexHours,
        createdAt: record.createdAt
      });
    } else if (type === 'agile') {
      setAgileForm({
        sprint: record.sprint,
        sp: record.storyPoints,
        status: record.status,
        type: record.type,
        createdAt: record.createdAt
      });
    } else if (type === 'financials') {
      setFinForm({
        month: record.month,
        cap: record.capacity,
        demand: record.demand,
        createdAt: record.createdAt
      });
    } else if (type === 'milestones') {
      setMilestoneForm({
        axiaId: record.axiaId,
        axiaName: record.axiaName,
        axiaOwnerCpc: record.axiaOwnerCpc,
        axiaMilestone: record.axiaMilestone,
        axiaMilestoneDescription: record.axiaMilestoneDescription,
        axiaMilestoneObjective: record.axiaMilestoneObjective,
        axiaMilestoneDueDate: record.axiaMilestoneDueDate,
        axiaMilestoneOwnerLtim: record.axiaMilestoneOwnerLtim,
        axiaMilestoneStatus: record.axiaMilestoneStatus,
        axiaMilestoneStatusDescription: record.axiaMilestoneStatusDescription,
        axiaMilestoneStatusDate: record.axiaMilestoneStatusDate,
        createdAt: record.createdAt
      });
    } else if (type === 'projects') {
      setProjectForm({
        project_id: record.project_id,
        project_name: record.project_name,
        project_status: record.project_status,
        start_date: record.start_date,
        target_end_date: record.target_end_date,
        budget_code: record.budget_code,
        project_manager_id: record.project_manager_id,
        org_unit_id: record.org_unit_id,
        createdAt: record.createdAt
      });
    } else if (type === 'master_resources') {
      setMasterResourceForm({
        resource_id: record.resource_id,
        first_name: record.first_name,
        last_name: record.last_name,
        email_address: record.email_address,
        primary_role: record.primary_role,
        is_full_time: record.is_full_time,
        onboarding_date: record.onboarding_date,
        manager_id: record.manager_id,
        org_unit_id: record.org_unit_id,
        location: record.location,
        allocation: record.allocation,
        status: record.status,
        offboarding_date: record.offboarding_date,
        createdAt: record.createdAt
      });
    } else if (type === 'skills') {
      setSkillForm({
        skill_id: record.skill_id,
        skill_name: record.skill_name,
        skill_category: record.skill_category,
        is_critical: record.is_critical,
        date_created: record.date_created,
        createdAt: record.createdAt
      });
    } else if (type === 'organizational_units') {
      setOrgUnitForm({
        org_unit_id: record.org_unit_id,
        unit_name: record.unit_name,
        parent_unit_id: record.parent_unit_id,
        unit_type: record.unit_type,
        cost_center_code: record.cost_center_code,
        createdAt: record.createdAt
      });
    } else if (type === 'roles') {
      setRoleForm({
        role_id: record.role_id,
        role_name: record.role_name,
        role_description: record.role_description,
        role_family: record.role_family,
        required_level: record.required_level,
        createdAt: record.createdAt
      });
    } else if (type === 'locations') {
      setLocationForm({
        location_id: record.location_id,
        location_name: record.location_name,
        city: record.city,
        country: record.country,
        time_zone: record.time_zone,
        is_physical_office: record.is_physical_office,
        createdAt: record.createdAt
      });
    } else if (type === 'resource_skills') {
      setResourceSkillForm({
        resource_id: record.resource_id,
        skill_id: record.skill_id,
        proficiency_level: record.proficiency_level,
        years_of_experience: record.years_of_experience,
        last_verified_date: record.last_verified_date,
        createdAt: record.createdAt
      });
    } else if (type === 'resource_projects') {
      setResourceProjectForm({
        resource_id: record.resource_id,
        project_id: record.project_id,
        assignment_start_date: record.assignment_start_date,
        assignment_end_date: record.assignment_end_date,
        role_on_project: record.role_on_project,
        allocated_capacity_pct: record.allocated_capacity_pct,
        is_flex_resource: record.is_flex_resource,
        createdAt: record.createdAt
      });
    } else if (type === 'rfc_tracking') {
      setRfcForm({
        axia_id: record.axia_id,
        base_requirements_count: record.base_requirements_count,
        base_requirements_lock_date: record.base_requirements_lock_date,
        base_requirements_details: record.base_requirements_details || '',
        delta_requirements_count: record.delta_requirements_count,
        delta_requirements_lock_date: record.delta_requirements_lock_date,
        delta_requirements_details: record.delta_requirements_details,
        createdAt: record.createdAt
      });
    } else if (type === 'project_cost_estimation') {
      setProjectCostForm({
        axia_id: record.axia_id,
        estimation_requested_date: record.estimation_requested_date,
        estimation_submitted_date: record.estimation_submitted_date,
        completed_within_sla: record.completed_within_sla,
        primary_contact: record.primary_contact,
        estimated_effort_hours: record.estimated_effort_hours,
        duration_months: record.duration_months,
        document_link: record.document_link || '',
        createdAt: record.createdAt
      });
    } else if (type === 'project_financials') {
      setProjectFinancialForm({
        axia_id: record.axia_id,
        supplier_name: record.supplier_name,
        monthly_forecast_amount: record.monthly_forecast_amount,
        monthly_forecast_date: record.monthly_forecast_date,
        monthly_actual_amount: record.monthly_actual_amount,
        monthly_actual_date: record.monthly_actual_date,
        comment: record.comment || '',
        createdAt: record.createdAt
      });
    } else if (type === 'defect_density') {
      setDefectDensityForm({
        axia_id: record.axia_id,
        warranty_period_start_date: record.warranty_period_start_date,
        warranty_period_end_date: record.warranty_period_end_date,
        defects_reported_during_warranty: record.defects_reported_during_warranty,
        test_cases_during_warranty: record.test_cases_during_warranty,
        defect_density_percentage: record.defect_density_percentage,
        reported_date: record.reported_date,
        comment: record.comment || '',
        createdAt: record.createdAt
      });
    } else if (type === 'defect_detection_efficiency') {
      setDefectDetectionEfficiencyForm({
        axia_id: record.axia_id,
        defects_found_by_supplier: record.defects_found_by_supplier,
        supplier_defects_rejected_by_cpchem: record.supplier_defects_rejected_by_cpchem,
        defects_found_by_cpchem: record.defects_found_by_cpchem,
        defects_rejected_during_uat_production: record.defects_rejected_during_uat_production,
        reported_date: record.reported_date,
        comment: record.comment || '',
        createdAt: record.createdAt
      });
    }
    
    // Switch to the correct tab
    setActiveTab(type);
  };

  const handleDelete = async (type, id) => {
    // Check permissions
    if (!ROLE_PERMISSIONS[userRole].canDelete) {
      alert('You do not have permission to delete records.');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this record?')) return;
    
    try {
      let collectionName;
      let recordData = null;
      
      // Get the record data before deletion for audit logging
      if (type === 'timesheets') {
        collectionName = COLLECTIONS.TIMESHEETS;
        recordData = timesheets.find(r => r.id === id);
      } else if (type === 'agile') {
        collectionName = COLLECTIONS.AGILE;
        recordData = agile.find(r => r.id === id);
      } else if (type === 'financials') {
        collectionName = COLLECTIONS.FINANCIALS;
        recordData = financials.find(r => r.id === id);
      } else if (type === 'milestones') {
        collectionName = COLLECTIONS.MILESTONES;
        recordData = milestones.find(r => r.id === id);
      } else if (type === 'projects') {
        collectionName = COLLECTIONS.PROJECTS;
        recordData = projects.find(r => r.id === id);
      } else if (type === 'master_resources') {
        collectionName = COLLECTIONS.MASTER_RESOURCES;
        recordData = master_resources.find(r => r.id === id);
      } else if (type === 'skills') {
        collectionName = COLLECTIONS.SKILLS;
        recordData = skills.find(r => r.id === id);
      } else if (type === 'organizational_units') {
        collectionName = COLLECTIONS.ORG_UNITS;
        recordData = organizational_units.find(r => r.id === id);
      } else if (type === 'roles') {
        collectionName = COLLECTIONS.ROLES;
        recordData = roles.find(r => r.id === id);
      } else if (type === 'locations') {
        collectionName = COLLECTIONS.LOCATIONS;
        recordData = locations.find(r => r.id === id);
      } else if (type === 'resource_skills') {
        collectionName = COLLECTIONS.RESOURCE_SKILLS;
        recordData = resource_skills.find(r => r.id === id);
      } else if (type === 'resource_projects') {
        collectionName = COLLECTIONS.RESOURCE_PROJECTS;
        recordData = resource_projects.find(r => r.id === id);
      } else if (type === 'rfc_tracking') {
        collectionName = COLLECTIONS.RFC_TRACKING;
        recordData = rfc_tracking.find(r => r.id === id);
      } else if (type === 'project_cost_estimation') {
        collectionName = COLLECTIONS.PROJECT_COST_ESTIMATION;
        recordData = project_cost_estimation.find(r => r.id === id);
      }
      
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, id));
      await logAuditEvent('DELETE', collectionName, id, recordData, null);
      
      setMsg('Record deleted successfully!');
      setTimeout(() => setMsg(''), 3000);
      refreshTrigger();
    } catch (err) {
      console.error(err);
      setMsg('Error deleting: ' + err.message);
    }
  };

  const handleCancelEdit = () => {
    setEditMode({ type: null, id: null });
    // Reset forms
    setTsForm({ week: '', core: '', flex: '' });
    setAgileForm({ sprint: '', sp: '', status: 'Done', type: 'Story' });
    setFinForm({ month: '', cap: '', demand: '' });
    setMilestoneForm({
      axiaId: '', axiaName: '', axiaOwnerCpc: '', axiaMilestone: '', axiaMilestoneDescription: '',
      axiaMilestoneObjective: '', axiaMilestoneDueDate: '', axiaMilestoneOwnerLtim: '',
      axiaMilestoneStatus: '', axiaMilestoneStatusDescription: '', axiaMilestoneStatusDate: ''
    });
    setProjectForm({
      project_id: '', project_name: '', project_status: 'In Progress', start_date: '', 
      target_end_date: '', budget_code: '', project_manager_id: '', org_unit_id: ''
    });
    setMasterResourceForm({
      resource_id: '', first_name: '', last_name: '', email_address: '', primary_role: '',
      is_full_time: true, onboarding_date: '', manager_id: '', org_unit_id: '',
      location: 'Onsite', allocation: 'Core', status: 'Active', offboarding_date: ''
    });
    setSkillForm({
      skill_id: '', skill_name: '', skill_category: '', is_critical: false, date_created: ''
    });
    setOrgUnitForm({
      org_unit_id: '', unit_name: '', parent_unit_id: '', unit_type: '', cost_center_code: ''
    });
    setRoleForm({
      role_id: '', role_name: '', role_description: '', role_family: '', required_level: 1
    });
    setLocationForm({
      location_id: '', location_name: '', city: '', country: '', time_zone: '', is_physical_office: true
    });
    setResourceSkillForm({
      resource_id: '', skill_id: '', proficiency_level: 1, years_of_experience: 0, last_verified_date: ''
    });
    setResourceProjectForm({
      resource_id: '', project_id: '', assignment_start_date: '', assignment_end_date: '',
      role_on_project: '', allocated_capacity_pct: 100, is_flex_resource: false
    });
  };

  // Filter and search functions
  const filterData = (data, type) => {
    let filtered = [...data];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(record => {
        switch (type) {
          case 'timesheets':
            return record.week?.toLowerCase().includes(term) ||
                   record.coreHours?.toString().includes(term) ||
                   record.flexHours?.toString().includes(term);
          case 'agile':
            return record.sprint?.toLowerCase().includes(term) ||
                   record.storyPoints?.toString().includes(term) ||
                   record.status?.toLowerCase().includes(term) ||
                   record.type?.toLowerCase().includes(term);
          case 'financials':
            return record.month?.toLowerCase().includes(term) ||
                   record.capacity?.toString().includes(term) ||
                   record.demand?.toString().includes(term);
          case 'milestones':
            return record.axiaId?.toLowerCase().includes(term) ||
                   record.axiaName?.toLowerCase().includes(term) ||
                   record.axiaMilestone?.toLowerCase().includes(term) ||
                   record.axiaMilestoneStatus?.toLowerCase().includes(term);
          case 'projects':
            return record.project_id?.toLowerCase().includes(term) ||
                   record.project_name?.toLowerCase().includes(term) ||
                   record.project_status?.toLowerCase().includes(term) ||
                   record.budget_code?.toLowerCase().includes(term);
          case 'master_resources':
            return record.resource_id?.toLowerCase().includes(term) ||
                   record.first_name?.toLowerCase().includes(term) ||
                   record.last_name?.toLowerCase().includes(term) ||
                   record.email_address?.toLowerCase().includes(term) ||
                   record.primary_role?.toLowerCase().includes(term) ||
                   record.status?.toLowerCase().includes(term);
          case 'skills':
            return record.skill_id?.toLowerCase().includes(term) ||
                   record.skill_name?.toLowerCase().includes(term) ||
                   record.skill_category?.toLowerCase().includes(term);
          case 'organizational_units':
            return record.org_unit_id?.toLowerCase().includes(term) ||
                   record.unit_name?.toLowerCase().includes(term) ||
                   record.unit_type?.toLowerCase().includes(term) ||
                   record.cost_center_code?.toLowerCase().includes(term);
          case 'roles':
            return record.role_id?.toLowerCase().includes(term) ||
                   record.role_name?.toLowerCase().includes(term) ||
                   record.role_family?.toLowerCase().includes(term);
          case 'locations':
            return record.location_id?.toLowerCase().includes(term) ||
                   record.location_name?.toLowerCase().includes(term) ||
                   record.city?.toLowerCase().includes(term) ||
                   record.country?.toLowerCase().includes(term);
          case 'resource_skills':
            return record.resource_id?.toLowerCase().includes(term) ||
                   record.skill_id?.toLowerCase().includes(term) ||
                   record.proficiency_level?.toString().includes(term);
          case 'resource_projects':
            return record.resource_id?.toLowerCase().includes(term) ||
                   record.project_id?.toLowerCase().includes(term) ||
                   record.role_on_project?.toLowerCase().includes(term);
          case 'rfc_tracking':
            return record.axia_id?.toLowerCase().includes(term) ||
                   record.base_requirements_count?.toString().includes(term) ||
                   record.delta_requirements_count?.toString().includes(term) ||
                   (record.delta_requirements_details || '').toLowerCase().includes(term);
          case 'project_cost_estimation':
            return record.axia_id?.toLowerCase().includes(term) ||
                   record.primary_contact?.toLowerCase().includes(term) ||
                   record.completed_within_sla?.toLowerCase().includes(term);
          case 'project_financials':
            return record.axia_id?.toLowerCase().includes(term) ||
                   record.supplier_name?.toLowerCase().includes(term) ||
                   record.comment?.toLowerCase().includes(term);
          case 'defect_density':
            return record.axia_id?.toLowerCase().includes(term) ||
                   record.comment?.toLowerCase().includes(term);
          case 'defect_detection_efficiency':
            return record.axia_id?.toLowerCase().includes(term) ||
                   record.comment?.toLowerCase().includes(term);
          default:
            return true;
        }
      });
    }

    // Apply date filters
    if (filterYear) {
      filtered = filtered.filter(record => {
        let dateStr = '';
        switch (type) {
          case 'timesheets':
            dateStr = record.week || '';
            break;
          case 'financials':
            dateStr = record.month || '';
            break;
          case 'milestones':
            dateStr = record.axiaMilestoneDueDate || '';
            break;
          case 'rfc_tracking':
            dateStr = record.delta_requirements_lock_date || '';
            break;
          case 'project_cost_estimation':
            dateStr = record.estimation_submitted_date || '';
            break;
          case 'project_financials':
            dateStr = record.monthly_actual_date || '';
            break;
          case 'defect_density':
            dateStr = record.reported_date || '';
            break;
          case 'defect_detection_efficiency':
            dateStr = record.reported_date || '';
            break;
          case 'agile':
            // For agile, we might not have a direct date, so skip filtering
            return true;
          default:
            return true;
        }
        return dateStr.startsWith(filterYear);
      });
    }

    if (filterMonth) {
      filtered = filtered.filter(record => {
        let dateStr = '';
        switch (type) {
          case 'financials':
            dateStr = record.month || '';
            break;
          case 'milestones':
            dateStr = record.axiaMilestoneDueDate || '';
            break;
          case 'rfc_tracking':
            dateStr = record.delta_requirements_lock_date || '';
            break;
          case 'project_cost_estimation':
            dateStr = record.estimation_submitted_date || '';
            break;
          case 'project_financials':
            dateStr = record.monthly_actual_date || '';
            break;
          case 'defect_density':
            dateStr = record.reported_date || '';
            break;
          case 'defect_detection_efficiency':
            dateStr = record.reported_date || '';
            break;
          case 'timesheets':
            // For timesheets, week format is YYYY-WW, so we need to convert
            if (record.week) {
              const [year, week] = record.week.split('-W');
              if (year === filterYear || !filterYear) {
                // Convert week to approximate month (rough approximation)
                const month = Math.ceil((parseInt(week) - 1) / 4.3) + 1;
                return month.toString().padStart(2, '0') === filterMonth;
              }
            }
            return false;
          case 'agile':
            return true;
          default:
            return true;
        }
        return dateStr.includes(`-${filterMonth}`);
      });
    }

    if (filterWeek && type === 'timesheets') {
      filtered = filtered.filter(record => {
        return record.week && record.week.endsWith(`-W${filterWeek}`);
      });
    }

    return filtered;
  };

  const seedData = async () => {
    setLoading(true);
    setMsg('Generating scenario data...');
    const batch = writeBatch(db);
    
    // Master Resources
    const masterResourcesData = [
        { resource_id: 'RES-001', first_name: 'John', last_name: 'Doe', email_address: 'john.doe@company.com', primary_role: 'Developer', location: 'New York', status: 'Active' },
        { resource_id: 'RES-002', first_name: 'Jane', last_name: 'Smith', email_address: 'jane.smith@company.com', primary_role: 'Designer', location: 'San Francisco', status: 'Active' },
        { resource_id: 'RES-003', first_name: 'Bob', last_name: 'Johnson', email_address: 'bob.johnson@company.com', primary_role: 'Manager', location: 'Chicago', status: 'Active' },
        { resource_id: 'RES-004', first_name: 'Alice', last_name: 'Williams', email_address: 'alice.williams@company.com', primary_role: 'Tester', location: 'Austin', status: 'Active' }
    ];
    masterResourcesData.forEach(r => {
        const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.MASTER_RESOURCES));
        batch.set(ref, r);
    });

    // Skills
    const skillsData = [
        { skill_id: 'SKILL-001', skill_name: 'JavaScript', skill_category: 'Programming', is_critical: true },
        { skill_id: 'SKILL-002', skill_name: 'React', skill_category: 'Frontend', is_critical: true },
        { skill_id: 'SKILL-003', skill_name: 'Node.js', skill_category: 'Backend', is_critical: false },
        { skill_id: 'SKILL-004', skill_name: 'Python', skill_category: 'Programming', is_critical: true },
        { skill_id: 'SKILL-005', skill_name: 'UI/UX Design', skill_category: 'Design', is_critical: false }
    ];
    skillsData.forEach(s => {
        const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.SKILLS));
        batch.set(ref, s);
    });

    // Projects
    const projectsData = [
        { project_id: 'AXIA-001', project_name: 'Project Alpha', project_status: 'In Progress', start_date: '2025-01-01', target_end_date: '2025-12-31', actual_kickoff_date: '2025-01-15' },
        { project_id: 'AXIA-002', project_name: 'Project Beta', project_status: 'In Progress', start_date: '2025-02-01', target_end_date: '2026-01-31', actual_kickoff_date: '2025-02-10' },
        { project_id: 'AXIA-003', project_name: 'Project Gamma', project_status: 'Planning', start_date: '2025-03-01', target_end_date: '2026-02-28', actual_kickoff_date: null }
    ];
    projectsData.forEach(p => {
        const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.PROJECTS));
        batch.set(ref, p);
    });

    // Resource Skills
    const resourceSkillsData = [
        { resource_id: 'RES-001', skill_id: 'SKILL-001', proficiency_level: 4, years_of_experience: 5, last_verified_date: '2025-12-01' },
        { resource_id: 'RES-001', skill_id: 'SKILL-002', proficiency_level: 3, years_of_experience: 3, last_verified_date: '2025-11-15' },
        { resource_id: 'RES-002', skill_id: 'SKILL-005', proficiency_level: 5, years_of_experience: 7, last_verified_date: '2025-12-10' },
        { resource_id: 'RES-003', skill_id: 'SKILL-001', proficiency_level: 2, years_of_experience: 2, last_verified_date: '2025-10-20' },
        { resource_id: 'RES-004', skill_id: 'SKILL-004', proficiency_level: 4, years_of_experience: 4, last_verified_date: '2025-11-30' }
    ];
    resourceSkillsData.forEach(rs => {
        const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.RESOURCE_SKILLS));
        batch.set(ref, rs);
    });

    // Resource Projects
    const resourceProjectsData = [
        { resource_id: 'RES-001', project_id: 'AXIA-001', role_on_project: 'Lead Developer', allocated_capacity_pct: 80, assignment_start_date: '2025-01-15', assignment_end_date: '2025-12-31', is_flex_resource: false },
        { resource_id: 'RES-002', project_id: 'AXIA-001', role_on_project: 'UI Designer', allocated_capacity_pct: 60, assignment_start_date: '2025-01-20', assignment_end_date: '2025-08-20', is_flex_resource: false },
        { resource_id: 'RES-003', project_id: 'AXIA-002', role_on_project: 'Project Manager', allocated_capacity_pct: 100, assignment_start_date: '2025-02-10', assignment_end_date: '2026-01-31', is_flex_resource: false },
        { resource_id: 'RES-004', project_id: 'AXIA-002', role_on_project: 'QA Lead', allocated_capacity_pct: 70, assignment_start_date: '2025-02-15', assignment_end_date: '2026-01-15', is_flex_resource: true }
    ];
    resourceProjectsData.forEach(rp => {
        const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.RESOURCE_PROJECTS));
        batch.set(ref, rp);
    });
    
    // Resources
    const resRef = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.RESOURCES));
    batch.set(resRef, { org: 'Supplier', count: 71, role: 'Mixed' });
    const resRef2 = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.RESOURCES));
    batch.set(resRef2, { org: 'Customer', count: 72, role: 'Mixed' });

    // Financials
    const finData = [
       { month: '2025-10', capacity: 500, demand: 480 },
       { month: '2025-11', capacity: 500, demand: 490 },
       { month: '2025-12', capacity: 500, demand: 600 },
       { month: '2026-01', capacity: 500, demand: 650 }
    ];
    finData.forEach(d => {
        const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FINANCIALS));
        batch.set(ref, { ...d, budget: 250000 });
    });

    // Agile
    const sprints = ['Sprint 24', 'Sprint 25', 'Sprint 26'];
    sprints.forEach(s => {
        for(let i=0; i<5; i++) {
             const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.AGILE));
             batch.set(ref, {
                 sprint: s,
                 storyPoints: Math.floor(Math.random() * 8) + 1,
                 status: 'Done',
                 type: 'Story'
             });
        }
    });

    // Timesheets
    const weeks = ['2025-W40', '2025-W41', '2025-W42'];
    weeks.forEach(w => {
         const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.TIMESHEETS));
         batch.set(ref, {
             week: w,
             coreHours: 2800,
             flexHours: Math.floor(Math.random() * 200)
         });
    });
    
    // SLA
    sprints.forEach(s => {
        const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.SLA));
        batch.set(ref, {
            sprint: s,
            defectDensity: (Math.random() * 0.15).toFixed(2),
            uatEscapes: Math.floor(Math.random() * 2)
        });
    });

    // Milestones
    const milestoneData = [
        { axiaId: 'AXIA-001', axiaName: 'Project Alpha', axiaOwnerCpc: 'John Doe', axiaMilestone: 'Phase 1 Complete', axiaMilestoneDescription: 'Complete initial development phase', axiaMilestoneObjective: 'Deliver core features', axiaMilestoneDueDate: '2025-12-31', axiaMilestoneOwnerLtim: 'Jane Smith', axiaMilestoneStatus: 'Achieved', axiaMilestoneStatusDescription: 'Completed on time', axiaMilestoneStatusDate: '2025-12-30' },
        { axiaId: 'AXIA-002', axiaName: 'Project Beta', axiaOwnerCpc: 'Alice Johnson', axiaMilestone: 'Testing Complete', axiaMilestoneDescription: 'Finish all testing activities', axiaMilestoneObjective: 'Ensure quality', axiaMilestoneDueDate: '2026-01-15', axiaMilestoneOwnerLtim: 'Bob Wilson', axiaMilestoneStatus: 'Delayed', axiaMilestoneStatusDescription: 'Delayed due to resource constraints', axiaMilestoneStatusDate: '2026-01-20' },
        { axiaId: 'AXIA-003', axiaName: 'Project Gamma', axiaOwnerCpc: 'Charlie Brown', axiaMilestone: 'Launch Ready', axiaMilestoneDescription: 'Prepare for production launch', axiaMilestoneObjective: 'Go live', axiaMilestoneDueDate: '2026-01-31', axiaMilestoneOwnerLtim: 'Diana Prince', axiaMilestoneStatus: 'On Track', axiaMilestoneStatusDescription: 'On schedule', axiaMilestoneStatusDate: '2026-01-10' }
    ];
    milestoneData.forEach(m => {
        const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.MILESTONES));
        batch.set(ref, m);
    });

    // Users (for user management demo)
    Object.entries(PREDEFINED_USERS).forEach(([username, userData]) => {
        const userRef = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), username);
        batch.set(userRef, {
            uid: username,
            email: userData.email,
            role: userData.role,
            name: userData.name,
            createdAt: Timestamp.now(),
            lastLogin: Timestamp.now()
        });
    });

    // Defect Density
    const defectDensityData = [
        { axia_id: 'AXIA-001', warranty_period_start_date: '2025-01-01', warranty_period_end_date: '2025-12-31', defects_reported_during_warranty: 15, test_cases_during_warranty: 200, defect_density_percentage: 92.5, reported_date: '2026-01-15', comment: 'Good quality control' },
        { axia_id: 'AXIA-002', warranty_period_start_date: '2025-06-01', warranty_period_end_date: '2026-05-31', defects_reported_during_warranty: 25, test_cases_during_warranty: 180, defect_density_percentage: 86.1, reported_date: '2026-01-10', comment: 'Some issues found during warranty' },
        { axia_id: 'AXIA-003', warranty_period_start_date: '2025-03-01', warranty_period_end_date: '2026-02-28', defects_reported_during_warranty: 8, test_cases_during_warranty: 220, defect_density_percentage: 96.4, reported_date: '2026-01-20', comment: 'Excellent defect prevention' }
    ];
    defectDensityData.forEach(d => {
        const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEFECT_DENSITY));
        batch.set(ref, d);
    });

    // Defect Detection Efficiency
    const defectDetectionEfficiencyData = [
        { axia_id: 'AXIA-001', defects_found_by_supplier: 15, supplier_defects_rejected_by_cpchem: 6, defects_found_by_cpchem: 6, defects_rejected_during_uat_production: 4, defect_detection_efficiency_percentage: 90.0, reported_date: '2026-01-15', comment: 'Excellent defect detection process' },
        { axia_id: 'AXIA-002', defects_found_by_supplier: 18, supplier_defects_rejected_by_cpchem: 8, defects_found_by_cpchem: 8, defects_rejected_during_uat_production: 4, defect_detection_efficiency_percentage: 83.3, reported_date: '2026-01-10', comment: 'Good performance, room for improvement' },
        { axia_id: 'AXIA-003', defects_found_by_supplier: 15, supplier_defects_rejected_by_cpchem: 5, defects_found_by_cpchem: 12, defects_rejected_during_uat_production: 8, defect_detection_efficiency_percentage: 50.0, reported_date: '2026-01-20', comment: 'Needs significant improvement in defect detection' }
    ];
    defectDetectionEfficiencyData.forEach(d => {
        const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEFECT_DETECTION_EFFICIENCY));
        batch.set(ref, d);
    });

    try {
        await batch.commit();
        setMsg('Scenario Data Loaded!');
    } catch(e) {
        setMsg("Error loading data: " + e.message);
    }
    setLoading(false);
    refreshTrigger();
  };

  // Reusing the CSS vars from Dashboard for consistency
  return (
    <div style={{maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'Segoe UI, sans-serif'}}>
       <style>{styles}</style>
       <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
         <h2 style={{color: '#051c2c', margin:0}}>Data Entry Portal</h2>
         <button onClick={seedData} disabled={loading} style={{padding:'8px 16px', background:'#333', color:'#fff', border:'none', borderRadius:'4px', cursor: 'pointer'}}>
            {loading ? 'Processing...' : 'Load Sample Data'}
         </button>
       </div>

       {msg && <div style={{background:'#e3f2fd', color:'#0d47a1', padding:'10px', borderRadius:'4px', marginBottom:'15px'}}>{msg}</div>}

       <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
         <button 
           onClick={() => setViewMode('add')} 
           style={{
             padding:'8px 16px', 
             background: viewMode === 'add' ? '#00a3e0' : '#f0f0f0', 
             color: viewMode === 'add' ? 'white' : '#333',
             border:'none', 
             borderRadius:'4px', 
             cursor: 'pointer'
           }}
         >
           Add Data
         </button>
         <button 
           onClick={() => setViewMode('view')} 
           style={{
             padding:'8px 16px', 
             background: viewMode === 'view' ? '#00a3e0' : '#f0f0f0', 
             color: viewMode === 'view' ? 'white' : '#333',
             border:'none', 
             borderRadius:'4px', 
             cursor: 'pointer'
           }}
         >
           View/Edit Data
         </button>
       </div>

       {viewMode === 'add' && (
         <>
           <div style={{display:'flex', borderBottom:'1px solid #ccc', marginBottom:'20px', flexWrap:'wrap'}}>
              {[
                { key: 'timesheets', label: 'Timesheets' },
                { key: 'agile', label: 'Agile Metrics' },
                { key: 'financials', label: 'Financials' },
                { key: 'milestones', label: 'Milestones' },
                { key: 'projects', label: 'Projects' },
                { key: 'master_resources', label: 'Resources' },
                { key: 'skills', label: 'Skills' },
                { key: 'organizational_units', label: 'Org Units' },
                { key: 'roles', label: 'Roles' },
                { key: 'locations', label: 'Locations' },
                { key: 'resource_skills', label: 'Resource Skills' },
                { key: 'resource_projects', label: 'Resource Projects' },
                { key: 'rfc_tracking', label: 'RFC Tracking' },
                { key: 'project_cost_estimation', label: 'Cost Estimation' },
                { key: 'project_financials', label: 'Project Financials' },
                { key: 'defect_density', label: 'Defect Density' },
                { key: 'defect_detection_efficiency', label: 'Defect Detection Efficiency' },
                { key: 'csv_upload', label: 'CSV Upload' }
              ].map(tab => (
              <button 
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                    padding:'10px 20px', 
                    background: 'none', 
                    border: 'none', 
                    borderBottom: activeTab === tab.key ? '3px solid #051c2c' : '3px solid transparent',
                    fontWeight: activeTab === tab.key ? 'bold' : 'normal',
                    cursor: 'pointer',
                    color: '#051c2c',
                    whiteSpace: 'nowrap'
                }}
              >
                  {tab.label}
              </button>
          ))}
       </div>

       <div style={{background:'#fff', padding:'20px', borderRadius:'4px', boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}}>
           {activeTab === 'timesheets' && (
               <form onSubmit={(e) => handleSubmit(e, 'timesheets')} style={{display:'grid', gap:'15px'}}>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Week (e.g., 2025-W41)</label>
                       <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={tsForm.week} onChange={e => setTsForm({...tsForm, week: e.target.value})} />
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Total Core Hours</label>
                           <input required type="number" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={tsForm.core} onChange={e => setTsForm({...tsForm, core: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Total Flex Hours</label>
                           <input required type="number" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={tsForm.flex} onChange={e => setTsForm({...tsForm, flex: e.target.value})} />
                       </div>
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'timesheets' && editMode.id ? 'Update Log' : 'Submit Log'}
                     </button>
                   )}
                   {editMode.type === 'timesheets' && editMode.id && (
                     <button 
                       type="button" 
                       onClick={handleCancelEdit}
                       style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                     >
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'agile' && (
                <form onSubmit={(e) => handleSubmit(e, 'agile')} style={{display:'grid', gap:'15px'}}>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                        <div>
                            <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Sprint Name</label>
                            <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={agileForm.sprint} onChange={e => setAgileForm({...agileForm, sprint: e.target.value})} />
                        </div>
                        <div>
                            <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Story Points (Done)</label>
                            <input required type="number" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={agileForm.sp} onChange={e => setAgileForm({...agileForm, sp: e.target.value})} />
                        </div>
                    </div>
                    {ROLE_PERMISSIONS[userRole].canAdd && (
                      <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                        {editMode.type === 'agile' && editMode.id ? 'Update Metrics' : 'Log Metrics'}
                      </button>
                    )}
                    {editMode.type === 'agile' && editMode.id && (
                      <button 
                        type="button" 
                        onClick={handleCancelEdit}
                        style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                      >
                        Cancel Edit
                      </button>
                    )}
                </form>
           )}

           {activeTab === 'financials' && (
               <form onSubmit={(e) => handleSubmit(e, 'financials')} style={{display:'grid', gap:'15px'}}>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Month (YYYY-MM)</label>
                       <input required type="month" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={finForm.month} onChange={e => setFinForm({...finForm, month: e.target.value})} />
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Capacity (SP)</label>
                           <input required type="number" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={finForm.cap} onChange={e => setFinForm({...finForm, cap: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Demand Forecast (SP)</label>
                           <input required type="number" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={finForm.demand} onChange={e => setFinForm({...finForm, demand: e.target.value})} />
                       </div>
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'financials' && editMode.id ? 'Update Forecast' : 'Add Forecast'}
                     </button>
                   )}
                   {editMode.type === 'financials' && editMode.id && (
                     <button 
                       type="button" 
                       onClick={handleCancelEdit}
                       style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                     >
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'milestones' && (
               <form onSubmit={(e) => handleSubmit(e, 'milestones')} style={{display:'grid', gap:'15px'}}>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Axia ID</label>
                           <SearchableSelect
                             value={milestoneForm.axiaId}
                             onChange={(value, selectedProject) => setMilestoneForm({
                               ...milestoneForm, 
                               axiaId: value,
                               axiaName: selectedProject ? selectedProject.project_name : ''
                             })}
                             options={projects}
                             placeholder="Select a project..."
                             required
                             displayFormat={(project) => `${project.project_id} - ${project.project_name}`}
                             searchFields={['project_id', 'project_name']}
                           />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Axia Name</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px', backgroundColor:'#f5f5f5'}} value={milestoneForm.axiaName} readOnly />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Axia Owner CPC</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={milestoneForm.axiaOwnerCpc} onChange={e => setMilestoneForm({...milestoneForm, axiaOwnerCpc: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Axia Milestone</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={milestoneForm.axiaMilestone} onChange={e => setMilestoneForm({...milestoneForm, axiaMilestone: e.target.value})} />
                       </div>
                   </div>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Axia Milestone Description</label>
                       <textarea style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px', minHeight:'60px'}} value={milestoneForm.axiaMilestoneDescription} onChange={e => setMilestoneForm({...milestoneForm, axiaMilestoneDescription: e.target.value})} />
                   </div>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Axia Milestone Objective</label>
                       <textarea style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px', minHeight:'60px'}} value={milestoneForm.axiaMilestoneObjective} onChange={e => setMilestoneForm({...milestoneForm, axiaMilestoneObjective: e.target.value})} />
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Axia Milestone Due Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={milestoneForm.axiaMilestoneDueDate} onChange={e => setMilestoneForm({...milestoneForm, axiaMilestoneDueDate: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Axia Milestone Owner LTIM</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={milestoneForm.axiaMilestoneOwnerLtim} onChange={e => setMilestoneForm({...milestoneForm, axiaMilestoneOwnerLtim: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Axia Milestone Status</label>
                           <select style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={milestoneForm.axiaMilestoneStatus} onChange={e => setMilestoneForm({...milestoneForm, axiaMilestoneStatus: e.target.value})}>
                               <option value="">Select Status</option>
                               <option value="Achieved">Achieved</option>
                               <option value="Delayed">Delayed</option>
                               <option value="At Risk">At Risk</option>
                               <option value="On Track">On Track</option>
                           </select>
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Axia Milestone Status Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={milestoneForm.axiaMilestoneStatusDate} onChange={e => setMilestoneForm({...milestoneForm, axiaMilestoneStatusDate: e.target.value})} />
                       </div>
                   </div>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Axia Milestone Status Description</label>
                       <textarea style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px', minHeight:'60px'}} value={milestoneForm.axiaMilestoneStatusDescription} onChange={e => setMilestoneForm({...milestoneForm, axiaMilestoneStatusDescription: e.target.value})} />
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'milestones' && editMode.id ? 'Update Milestone' : 'Log Milestone'}
                     </button>
                   )}
                   {editMode.type === activeTab && editMode.id && (
                     <button 
                       type="button" 
                       onClick={handleCancelEdit}
                       style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                     >
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'projects' && (
               <form onSubmit={(e) => handleSubmit(e, 'projects')} style={{display:'grid', gap:'15px'}}>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Axia ID</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectForm.project_id} onChange={e => setProjectForm({...projectForm, project_id: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Project Name</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectForm.project_name} onChange={e => setProjectForm({...projectForm, project_name: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Project Status</label>
                           <select style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectForm.project_status} onChange={e => setProjectForm({...projectForm, project_status: e.target.value})}>
                               <option value="In Progress">In Progress</option>
                               <option value="Squad Backlog">Squad Backlog</option>
                               <option value="Squad Execution">Squad Execution</option>
                               <option value="Hold">Hold</option>
                               <option value="Completed">Completed</option>
                           </select>
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Budget Code</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectForm.budget_code} onChange={e => setProjectForm({...projectForm, budget_code: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Start Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectForm.start_date} onChange={e => setProjectForm({...projectForm, start_date: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Target End Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectForm.target_end_date} onChange={e => setProjectForm({...projectForm, target_end_date: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Actual Kick-off Date</label>
                           <input type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectForm.actual_kickoff_date} onChange={e => setProjectForm({...projectForm, actual_kickoff_date: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Actual Completed Date</label>
                           <input type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectForm.actual_completed_date} onChange={e => setProjectForm({...projectForm, actual_completed_date: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <SearchableSelect
                         label="Project Manager ID"
                         value={projectForm.project_manager_id}
                         onChange={(value) => setProjectForm({...projectForm, project_manager_id: value})}
                         options={master_resources}
                         placeholder="Select a project manager..."
                         displayFormat={(resource) => `${resource.resource_id} - ${resource.first_name} ${resource.last_name}`}
                         searchFields={['resource_id', 'first_name', 'last_name', 'email_address']}
                       />
                       <SearchableSelect
                         label="Org Unit ID"
                         value={projectForm.org_unit_id}
                         onChange={(value) => setProjectForm({...projectForm, org_unit_id: value})}
                         options={organizational_units}
                         placeholder="Select an organizational unit..."
                         displayFormat={(orgUnit) => `${orgUnit.org_unit_id} - ${orgUnit.unit_name}`}
                         searchFields={['org_unit_id', 'unit_name', 'cost_center_code']}
                       />
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'projects' && editMode.id ? 'Update Project' : 'Add Project'}
                     </button>
                   )}
                   {editMode.type === activeTab && editMode.id && (
                     <button 
                       type="button" 
                       onClick={handleCancelEdit}
                       style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                     >
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'master_resources' && (
               <form onSubmit={(e) => handleSubmit(e, 'master_resources')} style={{display:'grid', gap:'15px'}}>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Resource ID</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={masterResourceForm.resource_id} onChange={e => setMasterResourceForm({...masterResourceForm, resource_id: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Email Address</label>
                           <input required type="email" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={masterResourceForm.email_address} onChange={e => setMasterResourceForm({...masterResourceForm, email_address: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>First Name</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={masterResourceForm.first_name} onChange={e => setMasterResourceForm({...masterResourceForm, first_name: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Last Name</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={masterResourceForm.last_name} onChange={e => setMasterResourceForm({...masterResourceForm, last_name: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Primary Role</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={masterResourceForm.primary_role} onChange={e => setMasterResourceForm({...masterResourceForm, primary_role: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Location</label>
                           <select style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={masterResourceForm.location} onChange={e => setMasterResourceForm({...masterResourceForm, location: e.target.value})}>
                               <option value="Onsite">Onsite</option>
                               <option value="Offshore">Offshore</option>
                           </select>
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Allocation</label>
                           <select style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={masterResourceForm.allocation} onChange={e => setMasterResourceForm({...masterResourceForm, allocation: e.target.value})}>
                               <option value="Core">Core</option>
                               <option value="Flex">Flex</option>
                               <option value="Other">Other</option>
                           </select>
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Status</label>
                           <select style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={masterResourceForm.status} onChange={e => setMasterResourceForm({...masterResourceForm, status: e.target.value})}>
                               <option value="Active">Active</option>
                               <option value="Offboarded">Offboarded</option>
                           </select>
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Onboarding Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={masterResourceForm.onboarding_date} onChange={e => setMasterResourceForm({...masterResourceForm, onboarding_date: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Offboarding Date</label>
                           <input type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={masterResourceForm.offboarding_date} onChange={e => setMasterResourceForm({...masterResourceForm, offboarding_date: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <SearchableSelect
                         label="Manager ID"
                         value={masterResourceForm.manager_id}
                         onChange={(value) => setMasterResourceForm({...masterResourceForm, manager_id: value})}
                         options={master_resources}
                         placeholder="Select a manager..."
                         displayFormat={(resource) => `${resource.resource_id} - ${resource.first_name} ${resource.last_name}`}
                         searchFields={['resource_id', 'first_name', 'last_name', 'email_address']}
                       />
                       <SearchableSelect
                         label="Org Unit ID"
                         value={masterResourceForm.org_unit_id}
                         onChange={(value) => setMasterResourceForm({...masterResourceForm, org_unit_id: value})}
                         options={organizational_units}
                         placeholder="Select an organizational unit..."
                         displayFormat={(orgUnit) => `${orgUnit.org_unit_id} - ${orgUnit.unit_name}`}
                         searchFields={['org_unit_id', 'unit_name', 'cost_center_code']}
                       />
                   </div>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>
                           <input type="checkbox" checked={masterResourceForm.is_full_time} onChange={e => setMasterResourceForm({...masterResourceForm, is_full_time: e.target.checked})} />
                           Full Time
                       </label>
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'master_resources' && editMode.id ? 'Update Resource' : 'Add Resource'}
                     </button>
                   )}
                   {editMode.type === activeTab && editMode.id && (
                     <button 
                       type="button" 
                       onClick={handleCancelEdit}
                       style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                     >
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'skills' && (
               <form onSubmit={(e) => handleSubmit(e, 'skills')} style={{display:'grid', gap:'15px'}}>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Skill ID</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={skillForm.skill_id} onChange={e => setSkillForm({...skillForm, skill_id: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Skill Name</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={skillForm.skill_name} onChange={e => setSkillForm({...skillForm, skill_name: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Skill Category</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={skillForm.skill_category} onChange={e => setSkillForm({...skillForm, skill_category: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Date Created</label>
                           <input type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={skillForm.date_created} onChange={e => setSkillForm({...skillForm, date_created: e.target.value})} />
                       </div>
                   </div>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>
                           <input type="checkbox" checked={skillForm.is_critical} onChange={e => setSkillForm({...skillForm, is_critical: e.target.checked})} />
                           Critical Skill
                       </label>
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'skills' && editMode.id ? 'Update Skill' : 'Add Skill'}
                     </button>
                   )}
                   {editMode.type === activeTab && editMode.id && (
                     <button 
                       type="button" 
                       onClick={handleCancelEdit}
                       style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                     >
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'organizational_units' && (
               <form onSubmit={(e) => handleSubmit(e, 'organizational_units')} style={{display:'grid', gap:'15px'}}>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Org Unit ID</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={orgUnitForm.org_unit_id} onChange={e => setOrgUnitForm({...orgUnitForm, org_unit_id: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Unit Name</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={orgUnitForm.unit_name} onChange={e => setOrgUnitForm({...orgUnitForm, unit_name: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Unit Type</label>
                           <select style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={orgUnitForm.unit_type} onChange={e => setOrgUnitForm({...orgUnitForm, unit_type: e.target.value})}>
                               <option value="Department">Department</option>
                               <option value="Tribe">Tribe</option>
                               <option value="Squad">Squad</option>
                               <option value="Chapter">Chapter</option>
                           </select>
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Cost Center Code</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={orgUnitForm.cost_center_code} onChange={e => setOrgUnitForm({...orgUnitForm, cost_center_code: e.target.value})} />
                       </div>
                   </div>
                   <div>
                       <SearchableSelect
                         label="Parent Unit ID"
                         value={orgUnitForm.parent_unit_id}
                         onChange={(value) => setOrgUnitForm({...orgUnitForm, parent_unit_id: value})}
                         options={organizational_units}
                         placeholder="Select a parent organizational unit..."
                         displayFormat={(orgUnit) => `${orgUnit.org_unit_id} - ${orgUnit.unit_name}`}
                         searchFields={['org_unit_id', 'unit_name', 'cost_center_code']}
                       />
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'organizational_units' && editMode.id ? 'Update Org Unit' : 'Add Org Unit'}
                     </button>
                   )}
                   {editMode.type === activeTab && editMode.id && (
                     <button 
                       type="button" 
                       onClick={handleCancelEdit}
                       style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                     >
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'roles' && (
               <form onSubmit={(e) => handleSubmit(e, 'roles')} style={{display:'grid', gap:'15px'}}>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Role ID</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={roleForm.role_id} onChange={e => setRoleForm({...roleForm, role_id: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Role Name</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={roleForm.role_name} onChange={e => setRoleForm({...roleForm, role_name: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Role Family</label>
                           <select style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={roleForm.role_family} onChange={e => setRoleForm({...roleForm, role_family: e.target.value})}>
                               <option value="Engineering">Engineering</option>
                               <option value="Design">Design</option>
                               <option value="Product">Product</option>
                               <option value="Operations">Operations</option>
                           </select>
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Required Level</label>
                           <input required type="number" min="1" max="5" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={roleForm.required_level} onChange={e => setRoleForm({...roleForm, required_level: e.target.value})} />
                       </div>
                   </div>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Role Description</label>
                       <textarea style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px', minHeight:'80px'}} value={roleForm.role_description} onChange={e => setRoleForm({...roleForm, role_description: e.target.value})} />
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'roles' && editMode.id ? 'Update Role' : 'Add Role'}
                     </button>
                   )}
                   {editMode.type === activeTab && editMode.id && (
                     <button 
                       type="button" 
                       onClick={handleCancelEdit}
                       style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                     >
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'locations' && (
               <form onSubmit={(e) => handleSubmit(e, 'locations')} style={{display:'grid', gap:'15px'}}>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Location ID</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={locationForm.location_id} onChange={e => setLocationForm({...locationForm, location_id: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Location Name</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={locationForm.location_name} onChange={e => setLocationForm({...locationForm, location_name: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>City</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={locationForm.city} onChange={e => setLocationForm({...locationForm, city: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Country</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={locationForm.country} onChange={e => setLocationForm({...locationForm, country: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Time Zone</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={locationForm.time_zone} onChange={e => setLocationForm({...locationForm, time_zone: e.target.value})} />
                       </div>
                       <div></div>
                   </div>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>
                           <input type="checkbox" checked={locationForm.is_physical_office} onChange={e => setLocationForm({...locationForm, is_physical_office: e.target.checked})} />
                           Physical Office
                       </label>
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'locations' && editMode.id ? 'Update Location' : 'Add Location'}
                     </button>
                   )}
                   {editMode.type === activeTab && editMode.id && (
                     <button 
                       type="button" 
                       onClick={handleCancelEdit}
                       style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                     >
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'resource_skills' && (
               <form onSubmit={(e) => handleSubmit(e, 'resource_skills')} style={{display:'grid', gap:'15px'}}>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <SearchableSelect
                         label="Resource ID"
                         value={resourceSkillForm.resource_id}
                         onChange={(value) => setResourceSkillForm({...resourceSkillForm, resource_id: value})}
                         options={master_resources}
                         placeholder="Select a resource..."
                         required
                         displayFormat={(resource) => `${resource.resource_id} - ${resource.first_name} ${resource.last_name}`}
                         searchFields={['resource_id', 'first_name', 'last_name', 'email_address']}
                       />
                       <SearchableSelect
                         label="Skill ID"
                         value={resourceSkillForm.skill_id}
                         onChange={(value) => setResourceSkillForm({...resourceSkillForm, skill_id: value})}
                         options={skills}
                         placeholder="Select a skill..."
                         required
                         displayFormat={(skill) => `${skill.skill_id} - ${skill.skill_name}`}
                         searchFields={['skill_id', 'skill_name', 'skill_category']}
                       />
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Proficiency Level (1-5)</label>
                           <input required type="number" min="1" max="5" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={resourceSkillForm.proficiency_level} onChange={e => setResourceSkillForm({...resourceSkillForm, proficiency_level: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Years of Experience</label>
                           <input required type="number" step="0.5" min="0" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={resourceSkillForm.years_of_experience} onChange={e => setResourceSkillForm({...resourceSkillForm, years_of_experience: e.target.value})} />
                       </div>
                   </div>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Last Verified Date</label>
                       <input type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={resourceSkillForm.last_verified_date} onChange={e => setResourceSkillForm({...resourceSkillForm, last_verified_date: e.target.value})} />
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'resource_skills' && editMode.id ? 'Update Resource Skill' : 'Add Resource Skill'}
                     </button>
                   )}
                   {editMode.type === activeTab && editMode.id && (
                     <button 
                       type="button" 
                       onClick={handleCancelEdit}
                       style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                     >
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'resource_projects' && (
               <form onSubmit={(e) => handleSubmit(e, 'resource_projects')} style={{display:'grid', gap:'15px'}}>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <SearchableSelect
                         label="Resource ID"
                         value={resourceProjectForm.resource_id}
                         onChange={(value) => setResourceProjectForm({...resourceProjectForm, resource_id: value})}
                         options={master_resources}
                         placeholder="Select a resource..."
                         required
                         displayFormat={(resource) => `${resource.resource_id} - ${resource.first_name} ${resource.last_name}`}
                         searchFields={['resource_id', 'first_name', 'last_name', 'email_address']}
                       />
                       <SearchableSelect
                         label="Axia ID"
                         value={resourceProjectForm.project_id}
                         onChange={(value) => setResourceProjectForm({...resourceProjectForm, project_id: value})}
                         options={projects}
                         placeholder="Select a project..."
                         required
                         displayFormat={(project) => `${project.project_id} - ${project.project_name}`}
                         searchFields={['project_id', 'project_name', 'budget_code']}
                       />
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Assignment Start Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={resourceProjectForm.assignment_start_date} onChange={e => setResourceProjectForm({...resourceProjectForm, assignment_start_date: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Assignment End Date</label>
                           <input type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={resourceProjectForm.assignment_end_date} onChange={e => setResourceProjectForm({...resourceProjectForm, assignment_end_date: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Role on Project</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={resourceProjectForm.role_on_project} onChange={e => setResourceProjectForm({...resourceProjectForm, role_on_project: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Allocated Capacity (%)</label>
                           <input required type="number" min="0" max="100" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={resourceProjectForm.allocated_capacity_pct} onChange={e => setResourceProjectForm({...resourceProjectForm, allocated_capacity_pct: e.target.value})} />
                       </div>
                   </div>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>
                           <input type="checkbox" checked={resourceProjectForm.is_flex_resource} onChange={e => setResourceProjectForm({...resourceProjectForm, is_flex_resource: e.target.checked})} />
                           Flex Resource Assignment
                       </label>
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'resource_projects' && editMode.id ? 'Update Assignment' : 'Add Assignment'}
                     </button>
                   )}
                   {editMode.type === activeTab && editMode.id && (
                     <button 
                       type="button" 
                       onClick={handleCancelEdit}
                       style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                     >
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'rfc_tracking' && (
               <form onSubmit={(e) => handleSubmit(e, 'rfc_tracking')} style={{display:'grid', gap:'15px'}}>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <SearchableSelect
                         label="Axia ID"
                         value={rfcForm.axia_id}
                         onChange={(value) => {
                           // Find the project to get the project_id instead of Firebase ID
                           const project = projects.find(p => p.id === value);
                           setRfcForm({...rfcForm, axia_id: project ? project.project_id : value});
                         }}
                         options={projects}
                         placeholder="Select a project..."
                         required
                         displayFormat={(project) => `${project.project_id} - ${project.project_name}`}
                         searchFields={['project_id', 'project_name']}
                       />
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Base Requirements Count</label>
                           <input required type="number" min="0" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={rfcForm.base_requirements_count} onChange={e => setRfcForm({...rfcForm, base_requirements_count: parseInt(e.target.value) || 0})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Base Requirements Lock-in Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={rfcForm.base_requirements_lock_date} onChange={e => setRfcForm({...rfcForm, base_requirements_lock_date: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Delta Requirements Count (RFCs)</label>
                           <input required type="number" min="0" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={rfcForm.delta_requirements_count} onChange={e => setRfcForm({...rfcForm, delta_requirements_count: parseInt(e.target.value) || 0})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Delta Requirements Lock-in Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={rfcForm.delta_requirements_lock_date} onChange={e => setRfcForm({...rfcForm, delta_requirements_lock_date: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>RFC Rate (%)</label>
                           <input 
                             type="number" 
                             step="0.01" 
                             min="0" 
                             max="100" 
                             style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px', backgroundColor:'#f5f5f5'}} 
                             value={rfcForm.base_requirements_count > 0 ? ((rfcForm.delta_requirements_count / rfcForm.base_requirements_count) * 100).toFixed(2) : '0.00'} 
                             readOnly 
                           />
                       </div>
                   </div>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Base Requirement Details</label>
                       <textarea 
                         style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px', minHeight:'80px'}} 
                         value={rfcForm.base_requirements_details} 
                         onChange={e => setRfcForm({...rfcForm, base_requirements_details: e.target.value})}
                         placeholder="Describe the base requirements..."
                       />
                   </div>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Delta Requirements Details</label>
                       <textarea 
                         style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px', minHeight:'80px'}} 
                         value={rfcForm.delta_requirements_details} 
                         onChange={e => setRfcForm({...rfcForm, delta_requirements_details: e.target.value})}
                         placeholder="Describe the RFCs and changes..."
                       />
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'rfc_tracking' && editMode.id ? 'Update RFC Tracking' : 'Add RFC Tracking'}
                     </button>
                   )}
                   {editMode.type === 'rfc_tracking' && editMode.id && (
                     <button 
                       type="button"
                       onClick={handleCancelEdit}
                       style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                     >
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'project_cost_estimation' && (
               <form onSubmit={(e) => handleSubmit(e, 'project_cost_estimation')} style={{display:'grid', gap:'15px'}}>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <SearchableSelect
                         label="Axia ID"
                         value={projectCostForm.axia_id}
                         onChange={(value) => setProjectCostForm({...projectCostForm, axia_id: value})}
                         options={projects}
                         valueKey="project_id"
                         placeholder="Select a project..."
                         required
                         displayFormat={(project) => `${project.project_id} - ${project.project_name}`}
                         searchFields={['project_id', 'project_name']}
                       />
                       <SearchableSelect
                           label="Primary Contact"
                           value={projectCostForm.primary_contact}
                           onChange={(value) => setProjectCostForm({...projectCostForm, primary_contact: value})}
                           options={master_resources}
                           valueKey="resource_id"
                           placeholder="Select a resource..."
                           required
                           displayFormat={(resource) => `${resource.resource_id} - ${resource.first_name} ${resource.last_name}`}
                           searchFields={['resource_id', 'first_name', 'last_name', 'email_address']}
                       />
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Estimation Requested Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectCostForm.estimation_requested_date} onChange={e => setProjectCostForm({...projectCostForm, estimation_requested_date: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Estimation Submitted Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectCostForm.estimation_submitted_date} onChange={e => setProjectCostForm({...projectCostForm, estimation_submitted_date: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Completed within 5 Days?</label>
                           <select style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectCostForm.completed_within_sla} onChange={e => setProjectCostForm({...projectCostForm, completed_within_sla: e.target.value})}>
                               <option value="Yes">Yes</option>
                               <option value="No">No</option>
                           </select>
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Estimated Effort (Hours)</label>
                           <input required type="number" min="0" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectCostForm.estimated_effort_hours} onChange={e => setProjectCostForm({...projectCostForm, estimated_effort_hours: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Duration (Months)</label>
                           <input required type="number" min="0" step="0.1" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectCostForm.duration_months} onChange={e => setProjectCostForm({...projectCostForm, duration_months: e.target.value})} />
                       </div>
                   </div>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Estimation Document Link</label>
                       <input type="url" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectCostForm.document_link} onChange={e => setProjectCostForm({...projectCostForm, document_link: e.target.value})} placeholder="https://..." />
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'project_cost_estimation' && editMode.id ? 'Update Estimation' : 'Add Estimation'}
                     </button>
                   )}
                   {editMode.type === 'project_cost_estimation' && editMode.id && (
                     <button type="button" onClick={handleCancelEdit} style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}>
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'project_financials' && (
               <form onSubmit={(e) => handleSubmit(e, 'project_financials')} style={{display:'grid', gap:'15px'}}>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <SearchableSelect
                         label="Axia ID"
                         value={projectFinancialForm.axia_id}
                         onChange={(value) => setProjectFinancialForm({...projectFinancialForm, axia_id: value})}
                         options={projects}
                         valueKey="project_id"
                         placeholder="Select a project..."
                         required
                         displayFormat={(project) => `${project.project_id} - ${project.project_name}`}
                         searchFields={['project_id', 'project_name']}
                       />
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Supplier Name</label>
                           <input required type="text" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectFinancialForm.supplier_name} onChange={e => setProjectFinancialForm({...projectFinancialForm, supplier_name: e.target.value})} placeholder="Enter supplier name..." />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Monthly Forecast Amount ($)</label>
                           <input required type="number" min="0" step="0.01" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectFinancialForm.monthly_forecast_amount} onChange={e => setProjectFinancialForm({...projectFinancialForm, monthly_forecast_amount: e.target.value})} placeholder="0.00" />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Monthly Forecast Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectFinancialForm.monthly_forecast_date} onChange={e => setProjectFinancialForm({...projectFinancialForm, monthly_forecast_date: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Monthly Actual Amount ($)</label>
                           <input required type="number" min="0" step="0.01" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectFinancialForm.monthly_actual_amount} onChange={e => setProjectFinancialForm({...projectFinancialForm, monthly_actual_amount: e.target.value})} placeholder="0.00" />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Monthly Actual Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={projectFinancialForm.monthly_actual_date} onChange={e => setProjectFinancialForm({...projectFinancialForm, monthly_actual_date: e.target.value})} />
                       </div>
                   </div>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Comment</label>
                       <textarea 
                         style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px', minHeight:'60px'}} 
                         value={projectFinancialForm.comment} 
                         onChange={e => setProjectFinancialForm({...projectFinancialForm, comment: e.target.value})}
                         placeholder="Optional comments..."
                       />
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'project_financials' && editMode.id ? 'Update Financials' : 'Add Financials'}
                     </button>
                   )}
                   {editMode.type === 'project_financials' && editMode.id && (
                     <button 
                       type="button"
                       onClick={handleCancelEdit}
                       style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                     >
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'defect_density' && (
               <form onSubmit={(e) => handleSubmit(e, 'defect_density')} style={{display:'grid', gap:'15px'}}>
                   <div style={{display:'grid', gridTemplateColumns:'1fr', gap:'15px'}}>
                       <SearchableSelect
                         label="Axia ID"
                         value={defectDensityForm.axia_id}
                         onChange={(value) => setDefectDensityForm({...defectDensityForm, axia_id: value})}
                         options={projects}
                         valueKey="project_id"
                         placeholder="Select a project..."
                         required
                         displayFormat={(project) => `${project.project_id} - ${project.project_name}`}
                         searchFields={['project_id', 'project_name']}
                       />
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Warranty Period Start Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={defectDensityForm.warranty_period_start_date} onChange={e => setDefectDensityForm({...defectDensityForm, warranty_period_start_date: e.target.value})} />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Warranty Period End Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={defectDensityForm.warranty_period_end_date} onChange={e => setDefectDensityForm({...defectDensityForm, warranty_period_end_date: e.target.value})} />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Defects Reported During Warranty Period</label>
                           <input required type="number" min="0" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={defectDensityForm.defects_reported_during_warranty} onChange={e => setDefectDensityForm({...defectDensityForm, defects_reported_during_warranty: e.target.value})} placeholder="0" />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Number of Test Cases During Warranty Period</label>
                           <input required type="number" min="0" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={defectDensityForm.test_cases_during_warranty} onChange={e => setDefectDensityForm({...defectDensityForm, test_cases_during_warranty: e.target.value})} placeholder="0" />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Defect Density % (Calculated)</label>
                           <input type="number" step="0.01" min="0" max="100" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px', backgroundColor:'#f5f5f5'}} value={defectDensityForm.defects_reported_during_warranty && defectDensityForm.test_cases_during_warranty ? (1 - (Number(defectDensityForm.defects_reported_during_warranty) - Number(defectDensityForm.test_cases_during_warranty))) * 100 : ''} readOnly placeholder="Auto-calculated" />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Reported Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={defectDensityForm.reported_date} onChange={e => setDefectDensityForm({...defectDensityForm, reported_date: e.target.value})} />
                       </div>
                   </div>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Comment</label>
                       <textarea 
                         style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px', minHeight:'60px'}} 
                         value={defectDensityForm.comment} 
                         onChange={e => setDefectDensityForm({...defectDensityForm, comment: e.target.value})}
                         placeholder="Optional comments..."
                       />
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'defect_density' && editMode.id ? 'Update Defect Density' : 'Add Defect Density'}
                     </button>
                   )}
                   {editMode.type === 'defect_density' && editMode.id && (
                     <button 
                       type="button"
                       onClick={handleCancelEdit}
                       style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                     >
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'defect_detection_efficiency' && (
               <form onSubmit={(e) => handleSubmit(e, 'defect_detection_efficiency')} style={{display:'grid', gap:'15px'}}>
                   <div style={{display:'grid', gridTemplateColumns:'1fr', gap:'15px'}}>
                       <SearchableSelect
                         label="Axia ID"
                         value={defectDetectionEfficiencyForm.axia_id}
                         onChange={(value) => setDefectDetectionEfficiencyForm({...defectDetectionEfficiencyForm, axia_id: value})}
                         options={projects}
                         valueKey="project_id"
                         placeholder="Select a project..."
                         required
                         displayFormat={(project) => `${project.project_id} - ${project.project_name}`}
                         searchFields={['project_id', 'project_name']}
                       />
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Defects Found by Supplier (A)</label>
                           <input required type="number" min="0" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={defectDetectionEfficiencyForm.defects_found_by_supplier} onChange={e => setDefectDetectionEfficiencyForm({...defectDetectionEfficiencyForm, defects_found_by_supplier: e.target.value})} placeholder="0" />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Supplier Defects Rejected by CPChem (B)</label>
                           <input required type="number" min="0" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={defectDetectionEfficiencyForm.supplier_defects_rejected_by_cpchem} onChange={e => setDefectDetectionEfficiencyForm({...defectDetectionEfficiencyForm, supplier_defects_rejected_by_cpchem: e.target.value})} placeholder="0" />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Defects Found by CPChem (C)</label>
                           <input required type="number" min="0" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={defectDetectionEfficiencyForm.defects_found_by_cpchem} onChange={e => setDefectDetectionEfficiencyForm({...defectDetectionEfficiencyForm, defects_found_by_cpchem: e.target.value})} placeholder="0" />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Defects Rejected During UAT/Production (D)</label>
                           <input required type="number" min="0" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={defectDetectionEfficiencyForm.defects_rejected_during_uat_production} onChange={e => setDefectDetectionEfficiencyForm({...defectDetectionEfficiencyForm, defects_rejected_during_uat_production: e.target.value})} placeholder="0" />
                       </div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Defect Detection Efficiency % (Calculated)</label>
                           <input type="number" step="0.01" min="0" max="100" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px', backgroundColor:'#f5f5f5'}} value={defectDetectionEfficiencyForm.defects_found_by_supplier && defectDetectionEfficiencyForm.supplier_defects_rejected_by_cpchem && defectDetectionEfficiencyForm.defects_found_by_cpchem && defectDetectionEfficiencyForm.defects_rejected_during_uat_production ? ((Number(defectDetectionEfficiencyForm.defects_found_by_supplier) - Number(defectDetectionEfficiencyForm.supplier_defects_rejected_by_cpchem)) / (Number(defectDetectionEfficiencyForm.defects_found_by_cpchem) + Number(defectDetectionEfficiencyForm.defects_rejected_during_uat_production))) * 100 : ''} readOnly placeholder="Auto-calculated" />
                       </div>
                       <div>
                           <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Reported Date</label>
                           <input required type="date" style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} value={defectDetectionEfficiencyForm.reported_date} onChange={e => setDefectDetectionEfficiencyForm({...defectDetectionEfficiencyForm, reported_date: e.target.value})} />
                       </div>
                   </div>
                   <div>
                       <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Comment</label>
                       <textarea 
                         style={{width:'100%', padding:'8px', border:'1px solid #ccc', borderRadius:'4px', minHeight:'60px'}} 
                         value={defectDetectionEfficiencyForm.comment} 
                         onChange={e => setDefectDetectionEfficiencyForm({...defectDetectionEfficiencyForm, comment: e.target.value})}
                         placeholder="Optional comments..."
                       />
                   </div>
                   {ROLE_PERMISSIONS[userRole].canAdd && (
                     <button type="submit" style={{padding:'10px', background:'#00a3e0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>
                       {editMode.type === 'defect_detection_efficiency' && editMode.id ? 'Update Defect Detection Efficiency' : 'Add Defect Detection Efficiency'}
                     </button>
                   )}
                   {editMode.type === 'defect_detection_efficiency' && editMode.id && (
                     <button 
                       type="button"
                       onClick={handleCancelEdit}
                       style={{padding:'10px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', marginLeft:'10px'}}
                     >
                       Cancel Edit
                     </button>
                   )}
               </form>
           )}

           {activeTab === 'csv_upload' && (
             <div style={{padding: '20px'}}>
               <h3>CSV Bulk Upload</h3>
               <p style={{marginBottom: '20px', color: '#666'}}>
                 Upload CSV files to bulk import data. Each CSV should have headers in the first row.
                 Dates should be in YYYY-MM-DD format. Boolean values should be 'true' or 'false'.
               </p>

               {uploadMsg && (
                 <div style={{
                   background: uploadMsg.includes('Error') || uploadMsg.includes('failed') ? '#ffebee' : '#e8f5e8',
                   color: uploadMsg.includes('Error') || uploadMsg.includes('failed') ? '#c62828' : '#2e7d32',
                   padding: '10px',
                   borderRadius: '4px',
                   marginBottom: '20px'
                 }}>
                   {uploadMsg}
                 </div>
               )}

               <CSVUpload
                 title="Upload Projects"
                 expectedHeaders={['project_id', 'project_name', 'project_status', 'start_date', 'target_end_date']}
                 onUpload={(rows) => handleCSVUpload('projects', rows, ['project_id', 'project_name'])}
                 loading={uploadLoading}
               />

               <CSVUpload
                 title="Upload Resources"
                 expectedHeaders={['resource_id', 'first_name', 'last_name', 'email_address', 'primary_role']}
                 onUpload={(rows) => handleCSVUpload('master_resources', rows, ['resource_id', 'first_name', 'last_name'])}
                 loading={uploadLoading}
               />

               <CSVUpload
                 title="Upload Milestones"
                 expectedHeaders={['axiaId', 'axiaName', 'axiaMilestone', 'axiaMilestoneDueDate']}
                 onUpload={(rows) => handleCSVUpload('milestones', rows, ['axiaId', 'axiaName', 'axiaMilestone'])}
                 loading={uploadLoading}
               />

               <CSVUpload
                 title="Upload Resource Projects"
                 expectedHeaders={['resource_id', 'project_id', 'role_on_project', 'allocated_capacity_pct']}
                 onUpload={(rows) => handleCSVUpload('resource_projects', rows, ['resource_id', 'project_id'])}
                 loading={uploadLoading}
               />

               <CSVUpload
                 title="Upload RFC Tracking"
                 expectedHeaders={['axia_id', 'base_requirements_count', 'base_requirements_lock_date', 'delta_requirements_count', 'delta_requirements_lock_date', 'delta_requirements_details']}
                 onUpload={(rows) => handleCSVUpload('rfc_tracking', rows, ['axia_id', 'base_requirements_lock_date'])}
                 loading={uploadLoading}
               />

               <CSVUpload
                 title="Upload Cost Estimations"
                 expectedHeaders={['axia_id', 'estimation_requested_date', 'estimation_submitted_date', 'completed_within_sla', 'primary_contact', 'estimated_effort_hours', 'duration_months', 'document_link']}
                 onUpload={(rows) => handleCSVUpload('project_cost_estimation', rows, ['axia_id', 'estimation_submitted_date'])}
                 loading={uploadLoading}
               />

               <CSVUpload
                 title="Upload Project Financials"
                 expectedHeaders={['axia_id', 'supplier_name', 'monthly_forecast_amount', 'monthly_forecast_date', 'monthly_actual_amount', 'monthly_actual_date', 'comment']}
                 onUpload={(rows) => handleCSVUpload('project_financials', rows, ['axia_id', 'supplier_name', 'monthly_actual_date'])}
                 loading={uploadLoading}
               />

               <CSVUpload
                 title="Upload Defect Density"
                 expectedHeaders={['axia_id', 'warranty_period_start_date', 'warranty_period_end_date', 'defects_reported_during_warranty', 'test_cases_during_warranty', 'reported_date', 'comment']}
                 onUpload={(rows) => handleCSVUpload('defect_density', rows, ['axia_id', 'reported_date'])}
                 loading={uploadLoading}
               />
             </div>
           )}
         </div>
       </>
       )}

       {viewMode === 'view' && (
         <div>
           <h3 style={{color: '#051c2c', marginBottom:'15px'}}>View & Edit Data</h3>
           
           {/* Search and Filter Controls */}
           <div style={{display:'flex', gap:'15px', marginBottom:'20px', flexWrap:'wrap'}}>
             <div>
               <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Search:</label>
               <input 
                 type="text" 
                 placeholder="Search..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px', width:'200px'}}
               />
             </div>
             <div>
               <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Year:</label>
               <select 
                 value={filterYear}
                 onChange={(e) => setFilterYear(e.target.value)}
                 style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}}
               >
                 <option value="">All Years</option>
                 <option value="2024">2024</option>
                 <option value="2025">2025</option>
                 <option value="2026">2026</option>
               </select>
             </div>
             <div>
               <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Month:</label>
               <select 
                 value={filterMonth}
                 onChange={(e) => setFilterMonth(e.target.value)}
                 style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}}
               >
                 <option value="">All Months</option>
                 <option value="01">January</option>
                 <option value="02">February</option>
                 <option value="03">March</option>
                 <option value="04">April</option>
                 <option value="05">May</option>
                 <option value="06">June</option>
                 <option value="07">July</option>
                 <option value="08">August</option>
                 <option value="09">September</option>
                 <option value="10">October</option>
                 <option value="11">November</option>
                 <option value="12">December</option>
               </select>
             </div>
             {viewTab === 'timesheets' && (
               <div>
                 <label style={{display:'block', marginBottom:'5px', fontSize:'14px'}}>Week:</label>
                 <select 
                   value={filterWeek}
                   onChange={(e) => setFilterWeek(e.target.value)}
                   style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}}
                 >
                   <option value="">All Weeks</option>
                   {Array.from({length: 52}, (_, i) => (
                     <option key={i+1} value={String(i+1).padStart(2, '0')}>
                       Week {String(i+1).padStart(2, '0')}
                     </option>
                   ))}
                 </select>
               </div>
             )}
             <div style={{display:'flex', alignItems:'end'}}>
               <button 
                 onClick={() => {
                   setSearchTerm('');
                   setFilterYear('');
                   setFilterMonth('');
                   setFilterWeek('');
                 }}
                 style={{padding:'8px 16px', background:'#666', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}
               >
                 Clear Filters
               </button>
             </div>
           </div>

           {/* Data Type Tabs */}
           <div style={{display:'flex', borderBottom:'1px solid #ccc', marginBottom:'20px', flexWrap:'wrap'}}>
             {[
               { key: 'timesheets', label: 'Timesheets' },
               { key: 'agile', label: 'Agile Metrics' },
               { key: 'financials', label: 'Financials' },
               { key: 'milestones', label: 'Milestones' },
               { key: 'projects', label: 'Projects' },
               { key: 'master_resources', label: 'Resources' },
               { key: 'skills', label: 'Skills' },
               { key: 'organizational_units', label: 'Org Units' },
               { key: 'roles', label: 'Roles' },
               { key: 'locations', label: 'Locations' },
               { key: 'resource_skills', label: 'Resource Skills' },
               { key: 'resource_projects', label: 'Resource Projects' },
               { key: 'rfc_tracking', label: 'RFC Tracking' },
               { key: 'project_cost_estimation', label: 'Cost Estimation' },
               { key: 'project_financials', label: 'Project Financials' },
               { key: 'defect_density', label: 'Defect Density' },
               { key: 'defect_detection_efficiency', label: 'Defect Detection Efficiency' }
             ].map(tab => (
               <button 
                 key={tab.key}
                 onClick={() => setViewTab(tab.key)}
                 style={{
                   padding:'10px 20px', 
                   background: 'none', 
                   border: 'none', 
                   borderBottom: viewTab === tab.key ? '3px solid #051c2c' : '3px solid transparent',
                   fontWeight: viewTab === tab.key ? 'bold' : 'normal',
                   cursor: 'pointer',
                   color: '#051c2c',
                   whiteSpace: 'nowrap'
                 }}
               >
                 {tab.label}
               </button>
             ))}
           </div>

           {/* Data Table */}
           <div style={{overflowX:'auto'}}>
             {viewTab === 'timesheets' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Week</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Core Hours</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Flex Hours</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(timesheets, 'timesheets').map((record, index) => (
                     <tr key={record.id || index}>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.week}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.coreHours}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.flexHours}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {ROLE_PERMISSIONS[userRole].canEdit && (
                           <button onClick={() => handleEdit('timesheets', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>
                         )}
                         {ROLE_PERMISSIONS[userRole].canDelete && (
                           <button onClick={() => handleDelete('timesheets', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}

             {viewTab === 'agile' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Sprint</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Story Points</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Status</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Type</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(agile, 'agile').map((record, index) => (
                     <tr key={record.id || index}>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.sprint}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.storyPoints}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.status}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.type}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {ROLE_PERMISSIONS[userRole].canEdit && (
                           <button onClick={() => handleEdit('agile', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>
                         )}
                         {ROLE_PERMISSIONS[userRole].canDelete && (
                           <button onClick={() => handleDelete('agile', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}

             {viewTab === 'financials' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Month</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Capacity</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Demand</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(financials, 'financials').map((record, index) => (
                     <tr key={record.id || index}>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.month}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.capacity}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.demand}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {ROLE_PERMISSIONS[userRole].canEdit && (
                           <button onClick={() => handleEdit('financials', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>
                         )}
                         {ROLE_PERMISSIONS[userRole].canDelete && (
                           <button onClick={() => handleDelete('financials', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}

             {viewTab === 'milestones' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Project</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Milestone</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Due Date</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Status</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(milestones, 'milestones').map((record, index) => (
                     <tr key={record.id || index}>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.axiaName} ({record.axiaId})</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.axiaMilestone}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{new Date(record.axiaMilestoneDueDate).toLocaleDateString()}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         <span style={{
                           color: record.axiaMilestoneStatus === 'Achieved' ? '#2ecc71' :
                                  record.axiaMilestoneStatus === 'Delayed' ? '#e74c3c' :
                                  record.axiaMilestoneStatus === 'At Risk' ? '#f39c12' : '#3498db',
                           fontWeight: 'bold'
                         }}>
                           {record.axiaMilestoneStatus}
                         </span>
                       </td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {ROLE_PERMISSIONS[userRole].canEdit && (
                           <button onClick={() => handleEdit('milestones', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>
                         )}
                         {ROLE_PERMISSIONS[userRole].canDelete && (
                           <button onClick={() => handleDelete('milestones', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}

             {viewTab === 'projects' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Axia ID</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Project Name</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Status</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Start Date</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Target End</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actual Kick-off</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actual Completed</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(projects, 'projects').map((record, index) => (
                     <tr key={record.id || index}>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.project_id}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.project_name}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         <span style={{
                           color: record.project_status === 'Completed' ? '#2ecc71' :
                                  record.project_status === 'Hold' ? '#e74c3c' :
                                  record.project_status === 'In Progress' ? '#3498db' : '#f39c12',
                           fontWeight: 'bold'
                         }}>
                           {record.project_status}
                         </span>
                       </td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.start_date ? new Date(record.start_date).toLocaleDateString() : ''}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.target_end_date ? new Date(record.target_end_date).toLocaleDateString() : ''}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.actual_kickoff_date ? new Date(record.actual_kickoff_date).toLocaleDateString() : ''}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.actual_completed_date ? new Date(record.actual_completed_date).toLocaleDateString() : ''}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {ROLE_PERMISSIONS[userRole].canEdit && (
                           <button onClick={() => handleEdit('projects', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>
                         )}
                         {ROLE_PERMISSIONS[userRole].canDelete && (
                           <button onClick={() => handleDelete('projects', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}

             {viewTab === 'master_resources' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Resource ID</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Name</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Email</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Role</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Location</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Status</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(master_resources, 'master_resources').map((record, index) => (
                     <tr key={record.id || index}>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.resource_id}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.first_name} {record.last_name}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.email_address}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.primary_role}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.location}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         <span style={{
                           color: record.status === 'Active' ? '#2ecc71' : '#e74c3c',
                           fontWeight: 'bold'
                         }}>
                           {record.status}
                         </span>
                       </td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {ROLE_PERMISSIONS[userRole].canEdit && (
                           <button onClick={() => handleEdit('master_resources', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>
                         )}
                         {ROLE_PERMISSIONS[userRole].canDelete && (
                           <button onClick={() => handleDelete('master_resources', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}

             {viewTab === 'skills' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Skill ID</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Skill Name</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Category</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Critical</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(skills, 'skills').map((record, index) => (
                     <tr key={record.id || index}>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.skill_id}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.skill_name}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.skill_category}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         <span style={{
                           color: record.is_critical ? '#e74c3c' : '#2ecc71',
                           fontWeight: 'bold'
                         }}>
                           {record.is_critical ? 'Yes' : 'No'}
                         </span>
                       </td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {ROLE_PERMISSIONS[userRole].canEdit && (
                           <button onClick={() => handleEdit('skills', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>
                         )}
                         {ROLE_PERMISSIONS[userRole].canDelete && (
                           <button onClick={() => handleDelete('skills', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}

             {viewTab === 'organizational_units' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Org Unit ID</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Unit Name</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Type</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Cost Center</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(organizational_units, 'organizational_units').map((record, index) => (
                     <tr key={record.id || index}>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.org_unit_id}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.unit_name}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.unit_type}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.cost_center_code}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {ROLE_PERMISSIONS[userRole].canEdit && (
                           <button onClick={() => handleEdit('organizational_units', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>
                         )}
                         {ROLE_PERMISSIONS[userRole].canDelete && (
                           <button onClick={() => handleDelete('organizational_units', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}

             {viewTab === 'roles' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Role ID</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Role Name</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Family</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Level</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(roles, 'roles').map((record, index) => (
                     <tr key={record.id || index}>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.role_id}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.role_name}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.role_family}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.required_level}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {ROLE_PERMISSIONS[userRole].canEdit && (
                           <button onClick={() => handleEdit('roles', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>
                         )}
                         {ROLE_PERMISSIONS[userRole].canDelete && (
                           <button onClick={() => handleDelete('roles', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}

             {viewTab === 'locations' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Location ID</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Location Name</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>City</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Country</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Physical Office</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(locations, 'locations').map((record, index) => (
                     <tr key={record.id || index}>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.location_id}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.location_name}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.city}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.country}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         <span style={{
                           color: record.is_physical_office ? '#2ecc71' : '#e74c3c',
                           fontWeight: 'bold'
                         }}>
                           {record.is_physical_office ? 'Yes' : 'No'}
                         </span>
                       </td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {ROLE_PERMISSIONS[userRole].canEdit && (
                           <button onClick={() => handleEdit('locations', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>
                         )}
                         {ROLE_PERMISSIONS[userRole].canDelete && (
                           <button onClick={() => handleDelete('locations', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}

             {viewTab === 'resource_skills' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Resource ID</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Skill ID</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Proficiency</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Years Experience</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Last Verified</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(resource_skills, 'resource_skills').map((record, index) => (
                     <tr key={record.id || index}>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{getResourceDisplay(record.resource_id, master_resources)}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{getSkillDisplay(record.skill_id, skills)}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.proficiency_level}/5</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.years_of_experience}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.last_verified_date ? new Date(record.last_verified_date).toLocaleDateString() : ''}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {ROLE_PERMISSIONS[userRole].canEdit && (
                           <button onClick={() => handleEdit('resource_skills', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>
                         )}
                         {ROLE_PERMISSIONS[userRole].canDelete && (
                           <button onClick={() => handleDelete('resource_skills', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}

             {viewTab === 'resource_projects' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Resource ID</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Axia ID</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Role on Project</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Capacity (%)</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Start Date</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>End Date</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Flex</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(resource_projects, 'resource_projects').map((record, index) => (
                     <tr key={record.id || index}>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{getResourceDisplay(record.resource_id, master_resources)}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{getProjectDisplay(record.project_id, projects)}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.role_on_project}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.allocated_capacity_pct}%</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.assignment_start_date ? new Date(record.assignment_start_date).toLocaleDateString() : ''}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.assignment_end_date ? new Date(record.assignment_end_date).toLocaleDateString() : ''}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         <span style={{
                           color: record.is_flex_resource ? '#f39c12' : '#2ecc71',
                           fontWeight: 'bold'
                         }}>
                           {record.is_flex_resource ? 'Yes' : 'No'}
                         </span>
                       </td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {ROLE_PERMISSIONS[userRole].canEdit && (
                           <button onClick={() => handleEdit('resource_projects', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>
                         )}
                         {ROLE_PERMISSIONS[userRole].canDelete && (
                           <button onClick={() => handleDelete('resource_projects', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}

             {viewTab === 'rfc_tracking' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Axia ID</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Base Requirements</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Base Lock Date</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Delta Requirements</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Delta Lock Date</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>RFC Rate (%)</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Details</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(rfc_tracking, 'rfc_tracking').map((record, index) => (
                     <tr key={record.id || index}>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.axia_id}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.base_requirements_count}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.base_requirements_lock_date ? new Date(record.base_requirements_lock_date).toLocaleDateString() : ''}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.delta_requirements_count}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.delta_requirements_lock_date ? new Date(record.delta_requirements_lock_date).toLocaleDateString() : ''}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {record.base_requirements_count > 0 ? ((record.delta_requirements_count / record.base_requirements_count) * 100).toFixed(2) : '0.00'}%
                       </td>
                       <td style={{padding:'8px', border:'1px solid #ddd', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis'}} title={record.delta_requirements_details}>
                         {record.delta_requirements_details}
                       </td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {ROLE_PERMISSIONS[userRole].canEdit && (
                           <button onClick={() => handleEdit('rfc_tracking', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>
                         )}
                         {ROLE_PERMISSIONS[userRole].canDelete && (
                           <button onClick={() => handleDelete('rfc_tracking', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}

             {viewTab === 'project_cost_estimation' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Axia ID</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Requested</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Submitted</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Within 5 Days</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Contact</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Effort (Hrs)</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Link</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(project_cost_estimation, 'project_cost_estimation').map((record, index) => (
                     <tr key={record.id || index}>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.axia_id}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.estimation_requested_date ? new Date(record.estimation_requested_date).toLocaleDateString() : ''}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.estimation_submitted_date ? new Date(record.estimation_submitted_date).toLocaleDateString() : ''}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}><span style={{color: record.completed_within_sla === 'Yes' ? '#2ecc71' : '#e74c3c', fontWeight: 'bold'}}>{record.completed_within_sla}</span></td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{getResourceDisplay(record.primary_contact, master_resources)}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.estimated_effort_hours}</td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {record.document_link && <a href={record.document_link} target="_blank" rel="noopener noreferrer" style={{color:'#00a3e0'}}>View</a>}
                       </td>
                       <td style={{padding:'8px', border:'1px solid #ddd'}}>
                         {ROLE_PERMISSIONS[userRole].canEdit && <button onClick={() => handleEdit('project_cost_estimation', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>}
                         {ROLE_PERMISSIONS[userRole].canDelete && <button onClick={() => handleDelete('project_cost_estimation', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}

             {viewTab === 'project_financials' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Axia ID</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Supplier</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Forecast ($)</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Forecast Date</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actual ($)</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actual Date</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Variance (%)</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Comment</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(project_financials, 'project_financials').map((record, index) => {
                     const forecast = Number(record.monthly_forecast_amount) || 0;
                     const actual = Number(record.monthly_actual_amount) || 0;
                     const variance = forecast > 0 ? ((forecast - actual) / forecast) * 100 : 0;
                     const varianceColor = Math.abs(variance) > 20 ? '#e74c3c' : Math.abs(variance) > 10 ? '#f39c12' : '#2ecc71';
                     
                     return (
                       <tr key={record.id || index}>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.axia_id}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.supplier_name}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{forecast.toLocaleString()}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.monthly_forecast_date ? new Date(record.monthly_forecast_date).toLocaleDateString() : ''}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{actual.toLocaleString()}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.monthly_actual_date ? new Date(record.monthly_actual_date).toLocaleDateString() : ''}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>
                           <span style={{color: varianceColor, fontWeight: 'bold'}}>
                             {variance.toFixed(1)}%
                           </span>
                         </td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.comment || ''}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>
                           {ROLE_PERMISSIONS[userRole].canEdit && <button onClick={() => handleEdit('project_financials', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>}
                           {ROLE_PERMISSIONS[userRole].canDelete && <button onClick={() => handleDelete('project_financials', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>}
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             )}

             {viewTab === 'defect_density' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Axia ID</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Warranty Start</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Warranty End</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Defects</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Test Cases</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Defect Density %</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Reported Date</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Status</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Comment</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(defect_density, 'defect_density').map((record, index) => {
                     const density = record.defect_density_percentage || 0;
                     const status = density >= 95 ? 'green' : density >= 90 ? 'amber' : 'red';
                     const statusColor = status === 'green' ? '#2ecc71' : status === 'amber' ? '#f39c12' : '#e74c3c';
                     
                     return (
                       <tr key={record.id || index}>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.axia_id}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.warranty_period_start_date ? new Date(record.warranty_period_start_date).toLocaleDateString() : ''}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.warranty_period_end_date ? new Date(record.warranty_period_end_date).toLocaleDateString() : ''}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.defects_reported_during_warranty}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.test_cases_during_warranty}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>
                           <span style={{color: statusColor, fontWeight: 'bold'}}>
                             {density.toFixed(2)}%
                           </span>
                         </td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.reported_date ? new Date(record.reported_date).toLocaleDateString() : ''}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>
                           <span style={{
                             color: statusColor,
                             fontWeight: 'bold',
                             textTransform: 'uppercase',
                             fontSize: '12px'
                           }}>
                             {status}
                           </span>
                         </td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.comment || ''}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>
                           {ROLE_PERMISSIONS[userRole].canEdit && <button onClick={() => handleEdit('defect_density', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>}
                           {ROLE_PERMISSIONS[userRole].canDelete && <button onClick={() => handleDelete('defect_density', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>}
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             )}

             {viewTab === 'defect_detection_efficiency' && (
               <table style={{width:'100%', borderCollapse:'collapse', border:'1px solid #ddd'}}>
                 <thead>
                   <tr style={{backgroundColor:'#f5f5f5'}}>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Axia ID</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Supplier Defects (A)</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Rejected by CPChem (B)</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>CPChem Defects (C)</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>UAT/Prod Rejects (D)</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>DDE %</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Reported Date</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Status</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Comment</th>
                     <th style={{padding:'8px', border:'1px solid #ddd', textAlign:'left'}}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filterData(defect_detection_efficiency, 'defect_detection_efficiency').map((record, index) => {
                     const efficiency = (record.defect_detection_efficiency_percentage || 0) * 100;
                     const status = efficiency < 80 ? 'red' : efficiency < 90 ? 'amber' : 'green';
                     const statusColor = status === 'green' ? '#2ecc71' : status === 'amber' ? '#f39c12' : '#e74c3c';
                     
                     return (
                       <tr key={record.id || index}>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.axia_id}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.defects_found_by_supplier}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.supplier_defects_rejected_by_cpchem}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.defects_found_by_cpchem}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.defects_rejected_during_uat_production}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>
                           <span style={{color: statusColor, fontWeight: 'bold'}}>
                             {efficiency.toFixed(2)}%
                           </span>
                         </td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.reported_date ? new Date(record.reported_date).toLocaleDateString() : ''}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>
                           <span style={{
                             color: statusColor,
                             fontWeight: 'bold',
                             textTransform: 'uppercase',
                             fontSize: '12px'
                           }}>
                             {status}
                           </span>
                         </td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>{record.comment || ''}</td>
                         <td style={{padding:'8px', border:'1px solid #ddd'}}>
                           {ROLE_PERMISSIONS[userRole].canEdit && <button onClick={() => handleEdit('defect_detection_efficiency', record, record.id)} style={{marginRight:'5px', padding:'4px 8px', background:'#00a3e0', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Edit</button>}
                           {ROLE_PERMISSIONS[userRole].canDelete && <button onClick={() => handleDelete('defect_detection_efficiency', record.id)} style={{padding:'4px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer'}}>Delete</button>}
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             )}
           </div>
         </div>
       )}
     </div>
   );
 };

// 3. MAIN APP CONTAINER
export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(USER_ROLES.DISPLAY_ONLY);
  const [userProfile, setUserProfile] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState({
    resources: [],
    timesheets: [],
    agile: [],
    slas: [],
    financials: [],
    milestones: [],
    users: [],
    auditLogs: [],
    // Master Data
    projects: [],
    master_resources: [],
    skills: [],
    organizational_units: [],
    roles: [],
    locations: [],
    // Junction Tables
    resource_skills: [],
    resource_projects: [],
    // RFC Tracking
    rfc_tracking: [],
    // Project Cost Estimation
    project_cost_estimation: [],
    // Project Financials
    project_financials: [],
    // Defect Density
    defect_density: [],
    // Defect Detection Efficiency
    defect_detection_efficiency: []
  });

  // Initialize Firebase auth for data access
  useEffect(() => {
    const initFirebaseAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error('Firebase auth error:', error);
      }
    };
    initFirebaseAuth();

    return onAuthStateChanged(auth, (firebaseUser) => {
      setFirebaseUser(firebaseUser);
    });
  }, []);

  // Data fetching - always called but conditional internally
  useEffect(() => {
    if (!isAuthenticated || !firebaseUser) return;

    // 3. Data Listeners
    const fetchData = () => {
        const qRes = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.RESOURCES));
        const qTime = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.TIMESHEETS), orderBy('week'));
        const qAgile = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.AGILE));
        const qSLA = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.SLA));
        const qFin = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.FINANCIALS));
        const qMilestones = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.MILESTONES));
        const qUsers = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS));
        const qAudit = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.AUDIT_LOGS), orderBy('timestamp', 'desc'));
        
        // Master Data Collections
        const qProjects = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.PROJECTS));
        const qMasterRes = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.MASTER_RESOURCES));
        const qSkills = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.SKILLS));
        const qOrgUnits = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.ORG_UNITS));
        const qRoles = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.ROLES));
        const qLocations = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.LOCATIONS));
        
        // Junction Tables
        const qResSkills = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.RESOURCE_SKILLS));
        const qResProjects = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.RESOURCE_PROJECTS));
        const qRfcTracking = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.RFC_TRACKING));
        const qProjectCost = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.PROJECT_COST_ESTIMATION));
        const qProjectFinancials = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.PROJECT_FINANCIALS));
        const qDefectDensity = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEFECT_DENSITY));
        const qDefectDetectionEfficiency = query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.DEFECT_DETECTION_EFFICIENCY));

        onSnapshot(qRes, (snap) => {
          setData(prev => ({ ...prev, resources: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qTime, (snap) => {
          setData(prev => ({ ...prev, timesheets: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qAgile, (snap) => {
          setData(prev => ({ ...prev, agile: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qSLA, (snap) => {
          setData(prev => ({ ...prev, slas: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qFin, (snap) => {
          setData(prev => ({ ...prev, financials: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qMilestones, (snap) => {
          setData(prev => ({ ...prev, milestones: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qUsers, (snap) => {
          setData(prev => ({ ...prev, users: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qAudit, (snap) => {
          setData(prev => ({ ...prev, auditLogs: snap.docs.map(d => d.data()) }));
        });
        
        // Master Data Listeners
        onSnapshot(qProjects, (snap) => {
          setData(prev => ({ ...prev, projects: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qMasterRes, (snap) => {
          setData(prev => ({ ...prev, master_resources: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qSkills, (snap) => {
          setData(prev => ({ ...prev, skills: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qOrgUnits, (snap) => {
          setData(prev => ({ ...prev, organizational_units: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qRoles, (snap) => {
          setData(prev => ({ ...prev, roles: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qLocations, (snap) => {
          setData(prev => ({ ...prev, locations: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        
        // Junction Table Listeners
        onSnapshot(qResSkills, (snap) => {
          setData(prev => ({ ...prev, resource_skills: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qResProjects, (snap) => {
          setData(prev => ({ ...prev, resource_projects: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qRfcTracking, (snap) => {
          setData(prev => ({ ...prev, rfc_tracking: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qProjectCost, (snap) => {
          setData(prev => ({ ...prev, project_cost_estimation: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qProjectFinancials, (snap) => {
          setData(prev => ({ ...prev, project_financials: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qDefectDensity, (snap) => {
          setData(prev => ({ ...prev, defect_density: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        onSnapshot(qDefectDetectionEfficiency, (snap) => {
          setData(prev => ({ ...prev, defect_detection_efficiency: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
    };

    fetchData();
  }, [isAuthenticated, firebaseUser]);

  const handleLogin = (userProfile) => {
    setUser({ uid: userProfile.uid, email: userProfile.email });
    setUserProfile(userProfile);
    setUserRole(userProfile.role);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setUser(null);
    setUserProfile(null);
    setUserRole(USER_ROLES.DISPLAY_ONLY);
    setIsAuthenticated(false);
    setView('dashboard');
  };

  const handleMonthChange = (month) => {
    setSelectedMonth(month);
  };

  // If not authenticated, show login screen
  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
  }

  // If Firebase not ready, show loading
  if (!firebaseUser) {
    return (
      <div style={{
        display:'flex', 
        height:'100vh', 
        justifyContent:'center', 
        alignItems:'center', 
        background: 'linear-gradient(135deg, #051c2c 0%, #00a3e0 100%)',
        fontFamily: 'Segoe UI, sans-serif',
        color: 'white'
      }}>
        <div style={{textAlign: 'center'}}>
          <div style={{
            fontSize: '48px',
            color: '#00a3e0',
            marginBottom: '20px'
          }}>
            <LucideIcons.LayoutGrid />
          </div>
          <h2>Connecting to SquadOps...</h2>
          <p>Please wait while we establish a secure connection.</p>
        </div>
      </div>
    );
  }

  const logAuditEvent = async (action, collectionName, recordId, oldData = null, newData = null) => {
    try {
      const auditEntry = {
        action: action, // 'CREATE', 'UPDATE', 'DELETE'
        collection: collectionName,
        recordId: recordId,
        userId: user.uid,
        userEmail: userProfile?.email || 'anonymous',
        userRole: userRole,
        timestamp: Timestamp.now(),
        oldData: oldData,
        newData: newData,
        ipAddress: null, // Could be added if available
        userAgent: navigator.userAgent
      };
      
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.AUDIT_LOGS), auditEntry);
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  };

  const handleRefresh = () => {
    // console.log("Refresh triggered");
  };

  return (
    <div style={{display:'flex', minHeight:'100vh', backgroundColor:'#f4f7f6', fontFamily: 'Segoe UI, sans-serif'}}>
      {/* SIDEBAR */}
      <div style={{width:'240px', backgroundColor:'#051c2c', color:'#a0a0a0', display:'flex', flexDirection:'column', flexShrink:0}}>
        <div style={{padding:'20px'}}>
          <div style={{color:'white', fontSize:'20px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'10px'}}>
            <LucideIcons.LayoutGrid color="#00a3e0" />
            SquadOps
          </div>
        </div>
        <nav style={{flex:1, padding:'10px'}}>
          <button 
            onClick={() => setView('dashboard')}
            style={{
                width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'12px 15px', 
                background: view === 'dashboard' ? '#00a3e0' : 'transparent', 
                color: view === 'dashboard' ? 'white' : 'inherit',
                border: 'none', borderRadius:'4px', cursor:'pointer', textAlign:'left', marginBottom:'5px'
            }}
          >
            <LucideIcons.BarChart2 size={18} />
            Dashboard
          </button>
          <button 
            onClick={() => setView('entry')}
            style={{
                width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'12px 15px', 
                background: view === 'entry' ? '#00a3e0' : 'transparent', 
                color: view === 'entry' ? 'white' : 'inherit',
                border: 'none', borderRadius:'4px', cursor:'pointer', textAlign:'left', marginBottom:'5px'
            }}
          >
            <LucideIcons.PenTool size={18} />
            Data Entry
          </button>
          <button 
            onClick={() => setView('financial_summary')}
            style={{
                width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'12px 15px', 
                background: view === 'financial_summary' ? '#00a3e0' : 'transparent', 
                color: view === 'financial_summary' ? 'white' : 'inherit',
                border: 'none', borderRadius:'4px', cursor:'pointer', textAlign:'left', marginBottom:'5px'
            }}
          >
            <LucideIcons.DollarSign size={18} />
            Financial Summary
          </button>
          {userRole === USER_ROLES.PROJECT_ADMIN && (
            <button 
              onClick={() => setView('users')}
              style={{
                  width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'12px 15px', 
                  background: view === 'users' ? '#00a3e0' : 'transparent', 
                  color: view === 'users' ? 'white' : 'inherit',
                  border: 'none', borderRadius:'4px', cursor:'pointer', textAlign:'left', marginBottom:'5px'
              }}
            >
              <LucideIcons.Users size={18} />
              User Management
            </button>
          )}
          {userRole === USER_ROLES.PROJECT_ADMIN && (
            <button 
              onClick={() => setView('audit')}
              style={{
                  width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'12px 15px', 
                  background: view === 'audit' ? '#00a3e0' : 'transparent', 
                  color: view === 'audit' ? 'white' : 'inherit',
                  border: 'none', borderRadius:'4px', cursor:'pointer', textAlign:'left'
              }}
            >
              <LucideIcons.FileText size={18} />
              Audit Logs
            </button>
          )}
        </nav>
        <div style={{padding:'20px', fontSize:'12px', borderTop:'1px solid #1a3c54'}}>
           <div style={{marginBottom:'10px'}}>
             <strong style={{color:'white'}}>Current User:</strong><br/>
             <span style={{color:'#00a3e0'}}>{userProfile?.name || userProfile?.email || 'Unknown'}</span>
           </div>
           <div style={{marginBottom:'15px'}}>
             <strong style={{color:'white'}}>Role:</strong><br/>
             <span style={{
               color: userRole === USER_ROLES.PROJECT_ADMIN ? '#e74c3c' :
                      userRole === USER_ROLES.PROJECT_MANAGER ? '#f39c12' : '#00a3e0',
               fontWeight: 'bold'
             }}>
               {userRole === USER_ROLES.PROJECT_ADMIN ? 'Project Admin' :
                userRole === USER_ROLES.PROJECT_MANAGER ? 'Project Manager' : 'Display Only'}
             </span>
           </div>
           <button
             onClick={handleLogout}
             style={{
               width: '100%',
               padding: '8px 12px',
               background: '#e74c3c',
               color: 'white',
               border: 'none',
               borderRadius: '4px',
               cursor: 'pointer',
               fontSize: '12px',
               marginBottom: '10px'
             }}
           >
             <LucideIcons.LogOut size={14} style={{marginRight: '5px'}} />
             Logout
           </button>
           <div>
             Squad Execution Model<br/>v2.1 Stable
           </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{flex:1, overflowY:'auto'}}>
           {view === 'dashboard' ? (
             <DashboardView data={data} onMonthChange={handleMonthChange} setView={setView} />
           ) : view === 'entry' ? (
             <DataEntryView key={selectedMonth} appId={appId} refreshTrigger={handleRefresh} data={data} user={user} userRole={userRole} logAuditEvent={logAuditEvent} selectedMonth={selectedMonth} />
           ) : view === 'financial_summary' ? (
             <FinancialSummaryView data={data} userRole={userRole} />
           ) : view === 'users' ? (
             <UserManagementView data={data} user={user} userRole={userRole} appId={appId} />
           ) : view === 'audit' ? (
             <AuditLogsView data={data} userRole={userRole} />
           ) : (
             <DashboardView data={data} onMonthChange={handleMonthChange} setView={setView} />
           )}
      </div>
    </div>
  );
}