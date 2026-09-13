import React from 'react';

export const AdminAuthContext = React.createContext({
  adminUser: null,
  setAdminUser: () => {},
});
