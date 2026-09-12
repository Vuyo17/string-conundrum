import React, { useState } from 'react';
import {
  BarChart3, BookOpen, FileText, LayoutDashboard, Users,
} from 'lucide-react';
import s from './Admin.module.css';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { OverviewPanel } from './OverviewPanel';
import { StudentsPanel } from './StudentsPanel';
import { MarksPanel } from './MarksPanel';
import { ModulesPanel } from './ModulesPanel';
import { ContentPanel } from './ContentPanel';
import { AnalyticsPanel } from './AnalyticsPanel';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'marks', label: 'Marks', icon: FileText },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'modules', label: 'Modules', icon: BookOpen },
  { id: 'content', label: 'Content', icon: FileText },
];

// The lecturer dashboard.
//
// Deliberately English-only, unlike the rest of the app. The student
// experience is bilingual because that is the research question; the lecturer
// surface is one person's admin tool, and mirroring ~150 new strings into
// locales/xh.json would mean machine-translating terminology ("misconception",
// "practice accuracy") that has no settled isiXhosa rendering yet -- worse
// than leaving it in the language the lecturer already reads the code in.
//
// Tabs are local state rather than routes because the app has no router at
// all; every screen is a key in App.jsx's screen map.
export function AdminDashboard() {
  const { user, isAdmin } = useAuth();
  const [tab, setTab] = useState('overview');
  // Set when a name is clicked anywhere -- the overview feed, the roster, the
  // marks table -- so every one of them opens the same student detail view
  // instead of each growing its own.
  const [openUid, setOpenUid] = useState(null);

  // The nav item is already hidden from students and every endpoint is gated
  // server-side, so this is the third layer rather than the only one. It
  // matters for the case where the role arrives after first paint.
  if (!isAdmin) {
    return (
      <div className={s.wrap}>
        <ScreenHeader title="Dashboard" />
        <div className={s.error}>
          This area is for lecturers. Your account ({user?.email || 'this account'})
          does not have access.
        </div>
      </div>
    );
  }

  function openStudent(uid) {
    setOpenUid(uid);
    setTab('students');
  }

  const panel = {
    overview: <OverviewPanel onOpenStudent={openStudent} />,
    students: (
      <StudentsPanel
        openUid={openUid}
        onOpenStudent={setOpenUid}
        onCloseStudent={() => setOpenUid(null)}
      />
    ),
    marks: <MarksPanel onOpenStudent={openStudent} />,
    analytics: <AnalyticsPanel />,
    modules: <ModulesPanel />,
    content: <ContentPanel />,
  }[tab];

  return (
    <div className={s.wrap}>
      <ScreenHeader
        title="Lecturer dashboard"
        subtitle="Manage modules and exercises, and follow how the class is doing."
      />

      <div className={s.tabs} role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`${s.tab} ${tab === id ? s.tabActive : ''}`}
            onClick={() => {
              setTab(id);
              // Leaving the Students tab closes whatever student was open, so
              // coming back lands on the roster rather than on whoever was
              // last inspected.
              if (id !== 'students') setOpenUid(null);
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {panel}
    </div>
  );
}
