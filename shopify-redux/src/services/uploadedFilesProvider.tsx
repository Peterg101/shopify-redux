import { createContext, useContext, useState, ReactNode } from 'react';
import { UploadedFile } from '../app/utility/interfaces';

interface UploadedFilesContextType {
  uploadedFiles: UploadedFile[]
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
}

const FileContext = createContext<UploadedFilesContextType | undefined>(undefined);

export const useUploadedFiles = () => {
  const context = useContext(FileContext);
  if (!context) {
    throw new Error("useUploadedFiles must be used within a FileProvider");
  }
  return context;
};

export const UploadedFilesProvider = ({ children }: { children: ReactNode }) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  return (
    <FileContext.Provider value={{ uploadedFiles: uploadedFiles, setUploadedFiles: setUploadedFiles }}>
      {children}
    </FileContext.Provider>
  );
};
