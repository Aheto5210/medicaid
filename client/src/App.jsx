import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, clearTokens, getStoredTokens, setTokens } from './api.js';
import { NAV_ITEMS } from './constants/options.js';
import Sidebar from './components/layout/Sidebar.jsx';
import Topbar from './components/layout/Topbar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PeoplePage from './pages/PeoplePage.jsx';
import NhisRegistrationPage from './pages/NhisRegistrationPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import UserManagementPage from './pages/UserManagementPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import RegisterModal from './components/people/RegisterModal.jsx';
import NhisRegisterModal from './components/nhis/NhisRegisterModal.jsx';
import { hasModulePermission, moduleKeyFromView, normalizePermissions } from './utils/permissions.js';
import { THEME_MODE, applyTheme, getStoredThemeMode, persistThemeMode, subscribeToSystemThemeChange } from './utils/theme.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('overview');
  const [people, setPeople] = useState([]);
  const [nhisRecords, setNhisRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registerContext, setRegisterContext] = useState(null);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [nhisSearch, setNhisSearch] = useState('');

  const currentYear = new Date().getFullYear();
  const [programYear, setProgramYear] = useState(currentYear);
  const [themeMode, setThemeMode] = useState(() => getStoredThemeMode());
  const [resolvedTheme, setResolvedTheme] = useState(() => applyTheme(getStoredThemeMode()));
  const [overviewViewKey, setOverviewViewKey] = useState(0);

  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, index) => currentYear - index),
    [currentYear]
  );

  const resolvedUser = useMemo(() => {
    if (!user) return null;
    return {
      ...user,
      permissions: normalizePermissions(user.permissions, user.role)
    };
  }, [user]);

  const canViewOverview = hasModulePermission(resolvedUser, 'overview', 'view');
  const canViewGeneralRegistration = hasModulePermission(resolvedUser, 'generalRegistration', 'view');
  const canCreateGeneralRegistration = hasModulePermission(resolvedUser, 'generalRegistration', 'create');
  const canViewNhisRegistration = hasModulePermission(resolvedUser, 'nhisRegistration', 'view');
  const canCreateNhisRegistration = hasModulePermission(resolvedUser, 'nhisRegistration', 'create');
  const canViewUserManagement = hasModulePermission(resolvedUser, 'userManagement', 'view');
  const canViewSettings = hasModulePermission(resolvedUser, 'settings', 'view');

  const availableNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => {
      const moduleKey = moduleKeyFromView(item.key);
      if (!moduleKey) return true;
      return hasModulePermission(resolvedUser, moduleKey, 'view');
    }),
    [resolvedUser]
  );

  const viewLabel = useMemo(
    () => availableNavItems.find((item) => item.key === view)?.label || availableNavItems[0]?.label || 'Overview',
    [availableNavItems, view]
  );

  useEffect(() => {
    const { accessToken } = getStoredTokens();
    if (!accessToken) {
      setLoading(false);
      return;
    }

    apiFetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUser(data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const nextResolvedTheme = applyTheme(themeMode);
    setResolvedTheme(nextResolvedTheme);
    persistThemeMode(themeMode);

    if (themeMode !== THEME_MODE.SYSTEM) {
      return undefined;
    }

    return subscribeToSystemThemeChange(() => {
      const updatedTheme = applyTheme(THEME_MODE.SYSTEM);
      setResolvedTheme(updatedTheme);
    });
  }, [themeMode]);

  useEffect(() => {
    if (!user) return;
    if (canViewOverview) {
      loadSummary(programYear);
    } else {
      setSummary(null);
    }
    if (canViewGeneralRegistration) {
      loadPeople(peopleSearch, programYear);
    } else {
      setPeople([]);
    }
    if (canViewNhisRegistration) {
      loadNhis(nhisSearch, programYear);
    } else {
      setNhisRecords([]);
    }
  }, [user, programYear, canViewOverview, canViewGeneralRegistration, canViewNhisRegistration]);

  useEffect(() => {
    if (!availableNavItems.length) return;
    if (!availableNavItems.some((item) => item.key === view)) {
      setView(availableNavItems[0].key);
    }
  }, [availableNavItems, view]);

  async function loadSummary(year = programYear) {
    const res = await apiFetch(`/api/analytics/summary?year=${year}`);
    if (res.ok) {
      const data = await res.json();
      setSummary(data);
    }
  }

  async function loadPeople(query = '', year = programYear) {
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    params.set('year', year);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await apiFetch(`/api/people${queryString}`);

    if (res.ok) {
      const data = await res.json();
      setPeople(data);
    }
  }

  async function loadNhis(searchValue = '', year = programYear) {
    const params = new URLSearchParams();
    if (searchValue) params.set('search', searchValue);
    params.set('year', year);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await apiFetch(`/api/nhis${queryString}`);

    if (res.ok) {
      const data = await res.json();
      setNhisRecords(data);
    }
  }

  async function handleLogin(result) {
    setTokens(result.accessToken, result.refreshToken);
    setUser(result.user);
  }

  function handleLogout() {
    clearTokens();
    setUser(null);
  }

  function handleTopbarThemeToggle() {
    setThemeMode((currentMode) => {
      const activeTheme = currentMode === THEME_MODE.SYSTEM ? resolvedTheme : currentMode;
      return activeTheme === THEME_MODE.DARK ? THEME_MODE.LIGHT : THEME_MODE.DARK;
    });
  }

  async function refreshOverviewData() {
    await Promise.all([
      loadSummary(programYear),
      loadPeople(peopleSearch, programYear)
    ]);
  }

  async function handleViewChange(nextView) {
    setView(nextView);

    if (nextView === 'overview' && canViewOverview) {
      setOverviewViewKey((prev) => prev + 1);
      await refreshOverviewData();
    }
  }

  const recentPeople = useMemo(() => people.slice(0, 5), [people]);

  if (loading) {
    return <div className="app-shell">Loading...</div>;
  }

  if (!user) {
    return (
      <AuthPage
        onSuccess={handleLogin}
        theme={resolvedTheme}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        items={availableNavItems}
        active={view}
        onChange={handleViewChange}
        theme={resolvedTheme}
      />

      <main className="main">
        <Topbar
          title={viewLabel}
          search={view === 'nhis' ? nhisSearch : peopleSearch}
          onSearch={async (value) => {
            if (view === 'nhis') {
              setNhisSearch(value);
              await loadNhis(value, programYear);
              return;
            }
            setPeopleSearch(value);
            await loadPeople(value, programYear);
          }}
          programYear={programYear}
          yearOptions={yearOptions}
          onYearChange={(value) => {
            setProgramYear(value);
          }}
          showSearch={(view === 'people' && canViewGeneralRegistration) || (view === 'nhis' && canViewNhisRegistration)}
          showYear={view === 'overview' || view === 'people' || view === 'nhis'}
          showNew={false}
          onNew={() => setRegisterContext(view === 'nhis' ? 'nhis' : 'people')}
          onLogout={handleLogout}
          resolvedTheme={resolvedTheme}
          onThemeToggle={handleTopbarThemeToggle}
        />

        {view === 'overview' && canViewOverview && (
          <DashboardPage
            key={overviewViewKey}
            summary={summary}
            recentPeople={recentPeople}
          />
        )}

        {view === 'people' && canViewGeneralRegistration && (
          <PeoplePage
            people={people}
            programYear={programYear}
            yearOptions={yearOptions}
            onYearChange={setProgramYear}
            onRefresh={() => loadPeople(peopleSearch, programYear)}
            onNew={() => setRegisterContext('people')}
            permissions={resolvedUser?.permissions}
          />
        )}

        {view === 'nhis' && canViewNhisRegistration && (
          <NhisRegistrationPage
            records={nhisRecords}
            programYear={programYear}
            yearOptions={yearOptions}
            onYearChange={setProgramYear}
            onRefresh={() => loadNhis(nhisSearch, programYear)}
            onNew={() => setRegisterContext('nhis')}
            permissions={resolvedUser?.permissions}
          />
        )}

        {view === 'settings' && canViewSettings && (
          <SettingsPage
            user={resolvedUser}
            themeMode={themeMode}
            resolvedTheme={resolvedTheme}
            onThemeModeChange={setThemeMode}
          />
        )}

        {view === 'users' && canViewUserManagement && (
          <UserManagementPage user={resolvedUser} />
        )}

        {!availableNavItems.length && (
          <section className="page">
            <div className="panel">
              <div className="empty">No modules assigned to this account yet. Please contact an admin.</div>
            </div>
          </section>
        )}
      </main>

      {registerContext === 'people' && canCreateGeneralRegistration && (
        <RegisterModal
          programYear={programYear}
          onClose={() => setRegisterContext(null)}
          onSaved={async () => {
            await loadPeople(peopleSearch, programYear);
            await loadSummary(programYear);
            setRegisterContext(null);
          }}
        />
      )}

      {registerContext === 'nhis' && canCreateNhisRegistration && (
        <NhisRegisterModal
          programYear={programYear}
          onClose={() => setRegisterContext(null)}
          onSaved={async () => {
            await loadNhis(nhisSearch, programYear);
            setRegisterContext(null);
          }}
        />
      )}
    </div>
  );
}
