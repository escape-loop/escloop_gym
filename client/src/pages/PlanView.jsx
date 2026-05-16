import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AppContent } from '../context/context.jsx';
import Sidebar from '../components/Sidebar.jsx';
import ToggleButton from '../components/ToggleButton.jsx';
import '../styles/dashboard.css';

export default function PlanView(){
  const location = useLocation();
  const navigate = useNavigate();
  const { backendurl } = useContext(AppContent);
  const plan = location.state?.plan;

  const formatOfferDate = (val) => {
    if (!val) return '-';
    // Try to parse ISO date strings
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime()) && /T|\d{4}-\d{2}-\d{2}/.test(val)) {
      const dd = String(parsed.getDate()).padStart(2, '0');
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const yyyy = parsed.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }
    // If not ISO but non-empty string, return as-is
    return val || '-';
  };

  if(!plan){
    return (
      <div className="dash-main">
        <div className="dash-content">
          <div style={{padding:40}}>No plan data provided. Go back to plans list.</div>
          <button className="btn-primary" onClick={() => navigate('/planslisting')}>Back to Plans</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Sidebar isOpen={false} />
      <main className={`main-content`}>
        <div className="dash-main">
          <header className="dash-header">
            <div className="dash-header-left">
              <ToggleButton isOpen={false} onClick={() => {}} />
              <div className="dash-breadcrumb">Dashboard / Membership Plans / View</div>
            </div>
            <div className="dash-header-right">
              <button className="btn-secondary" onClick={() => navigate(-1)}>Back</button>
              <button className="btn-primary" onClick={() => navigate('/membership', { state: { plan, isEditing: true } })}>Edit</button>
            </div>
          </header>

          <div className="dash-content">
            <div className="nm-card" style={{maxWidth:980, margin:'20px auto'}}>
              <div style={{display:'flex', gap:24}}>
                <div style={{flex:'0 0 320px'}}>
                  <img src={plan.image ? (plan.image.startsWith('http') ? plan.image : (plan.image.startsWith('/uploads/') ? `${backendurl.replace('/gym', '')}${plan.image}` : `${backendurl}${plan.image}`)) : '/api/placeholder/400/300'}
                    alt={plan.name}
                    style={{width:'100%', height: '220px', objectFit:'cover', borderRadius:8, border:'1px solid #e5e7eb'}}
                    onError={(e)=>{e.target.src='/api/placeholder/400/300'}}
                  />
                  <div style={{marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:18, fontWeight:700}}>{plan.name}</div>
                      <div style={{color:'#6b7280', fontSize:13}}>#{plan.planCode || 'N/A'}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:20, fontWeight:700}}>₹{plan.price || 0}</div>
                      <div style={{fontSize:13, color:'#6b7280'}}>{plan.durationDays || 0} days</div>
                    </div>
                  </div>
                </div>

                <div style={{flex:1}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:14, color:'#111827', fontWeight:600}}>{plan.type || 'Type'}</div>
                      <div style={{marginTop:8, color:'#374151'}}>{plan.description || 'No description provided.'}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{padding:'6px 10px', background: plan.status === 'Active' ? '#dcfce7' : '#f3f4f6', borderRadius:6, color: plan.status === 'Active' ? '#166534' : '#374151', fontWeight:600}}>{plan.status}</div>
                      <div style={{marginTop:10, color:'#6b7280'}}>Members: {plan.currentMembers || 0} / {plan.maxMembers > 0 ? plan.maxMembers : 'Unlimited'}</div>
                    </div>
                  </div>

                  <div style={{marginTop:18}}>
                    <h4 style={{margin:'6px 0'}}>Features</h4>
                    <ul>
                      {(plan.features && Array.isArray(plan.features) && plan.features.length > 0) ? (
                        plan.features.map((f,i)=> <li key={i} style={{marginBottom:6}}>{f}</li>)
                      ) : (
                        <li style={{color:'#6b7280'}}>No features listed.</li>
                      )}
                    </ul>
                  </div>

                  <div style={{marginTop:18, display:'flex', gap:16}}>
                    <div style={{flex:1}}>
                      <h4 style={{margin:'6px 0'}}>Offer Valid Till</h4>
                      <div style={{color:'#374151'}}>{formatOfferDate(plan.offerValid)}</div>
                    </div>
                    <div style={{flex:1}}>
                      <h4 style={{margin:'6px 0'}}>Max Members</h4>
                      <div style={{color:'#374151'}}>{plan.maxMembers > 0 ? plan.maxMembers : 'Unlimited'}</div>
                    </div>
                    <div style={{flex:1}}>
                      <h4 style={{margin:'6px 0'}}>Plan Code</h4>
                      <div style={{color:'#374151'}}>{plan.planCode || '—'}</div>
                    </div>
                    <div style={{flex:1}}>
                      <h4 style={{margin:'6px 0'}}>Created</h4>
                      <div style={{color:'#374151'}}>{plan.createdAt ? new Date(plan.createdAt).toLocaleString() : '—'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
