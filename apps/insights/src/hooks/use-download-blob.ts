import { useCallback } from "react";

export const useDownloadBlob = () => {
  return useCallback((blob: Blob, filename: string) => {
    const url = globalThis.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
  }, []);
};
