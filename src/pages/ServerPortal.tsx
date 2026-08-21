import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

const ServerPortal: React.FC = () => {
  const { uuid } = useParams();

  if (!uuid) {
    return <Navigate to="/servers" replace />;
  }

  return <Navigate to={`/server/${encodeURIComponent(uuid)}`} replace />;
};

export default ServerPortal;
