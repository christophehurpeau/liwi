import type { VisibilitySource } from "./types";

interface VisibilityDocument {
  visibilityState: string;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

const getVisibilityDocument = (): VisibilityDocument | undefined => {
  const { document } = globalThis as {
    document?: Partial<VisibilityDocument>;
  };
  if (!document) return undefined;
  if (typeof document.visibilityState !== "string") return undefined;
  if (typeof document.addEventListener !== "function") return undefined;
  if (typeof document.removeEventListener !== "function") return undefined;
  return document as VisibilityDocument;
};

export const detectVisibilitySource = (): VisibilitySource | undefined => {
  const visibilityDocument = getVisibilityDocument();
  if (!visibilityDocument) return undefined;

  return {
    isHidden: () => visibilityDocument.visibilityState === "hidden",
    listen: (listener) => {
      visibilityDocument.addEventListener("visibilitychange", listener);
      return (): void => {
        visibilityDocument.removeEventListener("visibilitychange", listener);
      };
    },
  };
};
