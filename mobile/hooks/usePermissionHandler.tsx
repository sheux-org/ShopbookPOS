import React, { createContext, useContext } from 'react';
import { useCameraPermissions } from 'expo-camera';

interface PermissionContextType {
  hasCameraAccess: boolean;
  requestCameraAccess: (onSuccess?: () => void) => void;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [permission, requestPermission] = useCameraPermissions();

  const hasCameraAccess = permission?.granted || false;

  const requestCameraAccess = (onSuccess?: () => void) => {
    if (permission?.granted) {
      if (onSuccess) onSuccess();
      return;
    }

    requestPermission()
      .then((response) => {
        if (response.granted && onSuccess) {
          onSuccess();
        }
      })
      .catch((err) => {
        console.error('System permission request failed:', err);
      });
  };

  return (
    <PermissionContext.Provider value={{ hasCameraAccess, requestCameraAccess }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermission = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermission must be used within a PermissionProvider');
  }
  return context;
};
