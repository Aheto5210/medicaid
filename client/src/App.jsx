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
import ConfirmDialog from './components/common/ConfirmDialog.jsx';
import RegisterModal from './components/people/RegisterModal.jsx';
import NhisRegisterModal from './components/nhis/NhisRegisterModal.jsx';
import { getRoleLabel } from './utils/roles.js';
import { hasModulePermission, moduleKeyFromView, normalizePermissions } from './utils/permissions.js';
import { THEME_MODE, applyTheme, getStoredThemeMode, persistThemeMode, subscribeToSystemThemeChange } from './utils/theme.js';
import { openAnalyticsReportPrintView } from './utils/analyticsReport.js';
import {
  OFFLINE_SYNC_EVENT,
  applyNhisOfflineMutations,
  applyPeopleOfflineMutations,
  getCachedValue,
  mapPersonSummaryFromList,
  removeCachedValue,
  setCachedValue,
  startOfflineSyncProcessor,
  subscribePendingMutations
} from './utils/offlineData.js';

const CACHE_KEY = {
  user: 'auth:user'
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [people, setPeople] = useState([]);
  const [nhisRecords, setNhisRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingMutations, setPendingMutations] = useState([]);
  const [registerContext, setRegisterContext] = useState(null);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [nhisSearch, setNhisSearch] = useState('');

  const currentYear = new Date().getFullYear();
  const [programYear, setProgramYear] = useState(currentYear);
  const [themeMode, setThemeMode] = useState(() => getStoredThemeMode());
  const [resolvedTheme, setResolvedTheme] = useState(() => applyTheme(getStoredThemeMode()));
  const [overviewViewKey, setOverviewViewKey] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState('');

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

  const effectivePeople = useMemo(
    () => applyPeopleOfflineMutations(people, pendingMutations, {
      programYear,
      search: peopleSearch
    }),
    [people, pendingMutations, peopleSearch, programYear]
  );
  const effectiveNhisRecords = useMemo(
    () => applyNhisOfflineMutations(nhisRecords, pendingMutations, {
      programYear,
      search: nhisSearch
    }),
    [nhisRecords, pendingMutations, nhisSearch, programYear]
  );
  const effectiveSummary = useMemo(() => {
    if (peopleSearch.trim()) return summary;
    if (!canViewGeneralRegistration) return summary;

    const derived = mapPersonSummaryFromList(effectivePeople);
    if (!summary) return derived;

    return {
      ...summary,
      totals: {
        ...summary.totals,
        ...derived.totals
      },
      gender: derived.gender,
      reasons: derived.reasons,
      ageRanges: derived.ageRanges,
      registrationSources: derived.registrationSources,
      occupations: derived.occupations
    };
  }, [summary, effectivePeople, peopleSearch, canViewGeneralRegistration]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = previousOverflow || '';
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      const { accessToken } = getStoredTokens();
      if (!accessToken) {
        if (active) setLoading(false);
        return;
      }

      const cachedUser = await getCachedValue(CACHE_KEY.user);
      if (active && cachedUser) {
        setUser(cachedUser);
        setLoading(false);
      }

      try {
        const res = await apiFetch('/api/auth/me');
        if (!res.ok) {
          if (active && !cachedUser) {
            setLoading(false);
          }
          return;
        }

        const data = await res.json();
        if (!active) return;

        setUser(data);
        await setCachedValue(CACHE_KEY.user, data);
      } catch {
        if (active && !cachedUser) {
          setLoading(false);
        }
        return;
      }

      if (active) {
        setLoading(false);
      }
    }

    bootstrapSession();

    return () => {
      active = false;
    };
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
    const stopProcessor = startOfflineSyncProcessor();
    const unsubscribe = subscribePendingMutations(setPendingMutations);

    function handleSyncComplete(event) {
      const scope = event.detail?.scope;
      if (scope === 'people') {
        void Promise.all([
          loadPeople(peopleSearch, programYear),
          loadSummary(programYear),
          loadNhis(nhisSearch, programYear)
        ]);
        return;
      }

      if (scope === 'nhis') {
        void loadNhis(nhisSearch, programYear);
      }
    }

    window.addEventListener(OFFLINE_SYNC_EVENT, handleSyncComplete);

    return () => {
      stopProcessor();
      unsubscribe();
      window.removeEventListener(OFFLINE_SYNC_EVENT, handleSyncComplete);
    };
  }, [peopleSearch, nhisSearch, programYear]);

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
    const cacheKey = `summary:${year}`;

    try {
      const res = await apiFetch(`/api/analytics/summary?year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
        await setCachedValue(cacheKey, data);
      }
    } catch {
      const cached = await getCachedValue(cacheKey);
      if (cached) {
        setSummary(cached);
      }
    }
  }

  async function loadPeople(query = '', year = programYear) {
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    params.set('year', year);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const cacheKey = `people:${year}:${query.trim().toLowerCase()}`;

    try {
      const res = await apiFetch(`/api/people${queryString}`);

      if (res.ok) {
        const data = await res.json();
        setPeople(data);
        await setCachedValue(cacheKey, data);
      }
    } catch {
      const cached = await getCachedValue(cacheKey);
      if (cached) {
        setPeople(cached);
      }
    }
  }

  async function loadNhis(searchValue = '', year = programYear) {
    const params = new URLSearchParams();
    if (searchValue) params.set('search', searchValue);
    params.set('year', year);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const cacheKey = `nhis:${year}:${searchValue.trim().toLowerCase()}`;

    try {
      const res = await apiFetch(`/api/nhis${queryString}`);

      if (res.ok) {
        const data = await res.json();
        setNhisRecords(data);
        await setCachedValue(cacheKey, data);
      }
    } catch {
      const cached = await getCachedValue(cacheKey);
      if (cached) {
        setNhisRecords(cached);
      }
    }
  }

  async function handleLogin(result) {
    setTokens(result.accessToken, result.refreshToken);
    setUser(result.user);
    await setCachedValue(CACHE_KEY.user, result.user);
  }

  async function refreshCurrentUserProfile() {
    const res = await apiFetch('/api/auth/me');
    if (!res.ok) return;

    const data = await res.json();
    setUser(data);
    await setCachedValue(CACHE_KEY.user, data);
  }

  function handleLogout() {
    clearTokens();
    setUser(null);
    void removeCachedValue(CACHE_KEY.user);
  }

  function handleOverviewThemeToggle() {
    setThemeMode((currentMode) => {
      if (currentMode === THEME_MODE.SYSTEM) {
        return resolvedTheme === THEME_MODE.DARK ? THEME_MODE.LIGHT : THEME_MODE.DARK;
      }

      return THEME_MODE.SYSTEM;
    });
  }

  async function refreshOverviewData() {
    await Promise.all([
      loadSummary(programYear),
      loadPeople(peopleSearch, programYear)
    ]);
  }

  async function handleGenerateOverviewReport() {
    setReporting(true);
    setReportError('');

    try {
      const res = await apiFetch(`/api/analytics/summary?year=${programYear}`);
      if (!res.ok) {
        let nextError = 'Unable to prepare the analytics report right now.';

        try {
          const data = await res.json();
          if (data?.message) {
            nextError = data.message;
          }
        } catch {
          // Ignore non-JSON error payloads.
        }

        throw new Error(nextError);
      }

      const reportSummary = await res.json();
      const logoUrl = new URL('/assets/images/MEDICAID-BLACK.png?v=20260325', window.location.origin).toString();

      openAnalyticsReportPrintView({
        summary: reportSummary,
        year: programYear,
        user: resolvedUser ? {
          ...resolvedUser,
          role: getRoleLabel(resolvedUser.role)
        } : null,
        logoUrl
      });
    } catch (error) {
      setReportError(error.message || 'Unable to prepare the analytics report right now.');
    } finally {
      setReporting(false);
    }
  }

  async function handleViewChange(nextView) {
    setView(nextView);
    setMobileSidebarOpen(false);

    if (nextView === 'overview' && canViewOverview) {
      setOverviewViewKey((prev) => prev + 1);
      await refreshOverviewData();
    }
  }

  const effectiveRecentPeople = useMemo(() => effectivePeople.slice(0, 5), [effectivePeople]);
  const overviewTopbarActions = view === 'overview' && canViewOverview ? (
    <div className="overview-topbar-actions">
      <button
        className="ghost icon-button theme-toggle"
        type="button"
        onClick={handleOverviewThemeToggle}
        aria-label={
          themeMode === THEME_MODE.SYSTEM
            ? `Switch to ${resolvedTheme === THEME_MODE.DARK ? 'light' : 'dark'} mode`
            : 'Return to system theme'
        }
        title={
          themeMode === THEME_MODE.SYSTEM
            ? `System theme active: ${resolvedTheme === THEME_MODE.DARK ? 'Dark' : 'Light'}`
            : `Manual ${themeMode === THEME_MODE.DARK ? 'Dark' : 'Light'} mode active`
        }
      >
        {resolvedTheme === THEME_MODE.DARK ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 15.5A7.5 7.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2.5V5" />
            <path d="M12 19v2.5" />
            <path d="M4.5 12H2" />
            <path d="M22 12h-2.5" />
            <path d="M5.8 5.8 7.5 7.5" />
            <path d="m16.5 16.5 1.7 1.7" />
            <path d="m18.2 5.8-1.7 1.7" />
            <path d="m7.5 16.5-1.7 1.7" />
          </svg>
        )}
      </button>
      <button className="primary" type="button" onClick={handleGenerateOverviewReport} disabled={reporting}>
        {reporting ? 'Preparing Report...' : 'Generate Report'}
      </button>
    </div>
  ) : null;

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
        onLogout={() => setShowLogoutConfirm(true)}
        theme={resolvedTheme}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <main className={`main ${view === 'overview' ? 'dashboard-main' : ''}`}>
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
          showSearch={(view === 'people' && canViewGeneralRegistration) || (view === 'nhis' && canViewNhisRegistration)}
          showMenuToggle
          onMenuToggle={() => setMobileSidebarOpen((current) => !current)}
          extraActions={overviewTopbarActions}
          stackTitleOnMobile={view === 'overview'}
        />

        {view === 'overview' && canViewOverview && (
          <>
            {reportError && <div className="error">{reportError}</div>}
            <DashboardPage
              key={overviewViewKey}
              summary={effectiveSummary}
              recentPeople={effectiveRecentPeople}
            />
          </>
        )}

        {view === 'people' && canViewGeneralRegistration && (
          <PeoplePage
            people={effectivePeople}
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
            records={effectiveNhisRecords}
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
            resolvedTheme={resolvedTheme}
            themeMode={themeMode}
          />
        )}

        {view === 'users' && canViewUserManagement && (
          <UserManagementPage user={resolvedUser} onCurrentUserUpdated={refreshCurrentUserProfile} />
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

      {showLogoutConfirm && (
        <ConfirmDialog
          title="Log out"
          message="Are you sure you want to log out of MEDICAID on this device?"
          cancelLabel="Stay here"
          confirmLabel="Log out"
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={() => {
            setShowLogoutConfirm(false);
            handleLogout();
          }}
        />
      )}
    </div>
  );
}
