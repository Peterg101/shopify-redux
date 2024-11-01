import { createContext, useContext, useState, ReactNode } from 'react';

interface FileContextType {
  actualFile: File | null;
  setActualFile: React.Dispatch<React.SetStateAction<File | null>>;
}

const FileContext = createContext<FileContextType | undefined>(undefined);

export const useFile = () => {
  const context = useContext(FileContext);
  if (!context) {
    throw new Error("useFile must be used within a FileProvider");
  }
  return context;
};

export const FileProvider = ({ children }: { children: ReactNode }) => {
  const [actualFile, setActualFile] = useState<File | null>(null);
  return (
    <FileContext.Provider value={{ actualFile, setActualFile }}>
      {children}
    </FileContext.Provider>
  );
};
