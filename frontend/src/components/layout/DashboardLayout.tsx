import { Outlet } from 'react-router-dom';

import { ImportDropZone } from '../common/ImportDropZone';
import { Sidebar } from '../common/Sidebar';

export function DashboardLayout() {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <Outlet />
      </main>
      <ImportDropZone />
    </div>
  );
}
