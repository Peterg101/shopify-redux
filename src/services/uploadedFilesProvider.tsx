import { createContext, useContext, useState, ReactNode } from 'react';
import { UploadedFile } from '../app/utility/interfaces';

interface UploadedFilesContextType {
  uploadedFile: UploadedFile[] | null;
  setUploadedFileType: React.Dispatch<React.SetStateAction<UploadedFile[] | null>>;
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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[] | null>(null);

  return (
    <FileContext.Provider value={{ uploadedFile: uploadedFiles, setUploadedFileType: setUploadedFiles }}>
      {children}
    </FileContext.Provider>
  );
};
