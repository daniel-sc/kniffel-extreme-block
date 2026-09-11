import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startScoreDiagnostics } from '@/utils/scoreDiagnostics';

startScoreDiagnostics();

createRoot(document.getElementById("root")!).render(<App />);
