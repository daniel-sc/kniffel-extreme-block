import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { captureScoreDiagnostics, scoreDiagnosticsEnabled } from '@/utils/scoreDiagnostics';

export const ScoreDiagnostics = () => {
  const [report, setReport] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState('Bericht kopieren');
  const pendingReport = useRef<string | null>(null);

  if (!scoreDiagnosticsEnabled) return null;

  const copyReport = async (): Promise<void> => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopyStatus('Kopiert');
    } catch (error) {
      console.error('Unable to copy score diagnostics:', error);
      setCopyStatus('Bitte Text unten auswählen und kopieren');
    }
  };

  return (
    <>
      <Button
        className="fixed bottom-3 left-3 z-50 shadow-lg"
        style={{ bottom: 'calc(var(--safe-area-bottom) + 0.75rem)' }}
        onPointerDown={() => {
          // Capture before button focus or the dialog can disturb the blank field.
          pendingReport.current = captureScoreDiagnostics();
        }}
        onPointerCancel={() => { pendingReport.current = null; }}
        onClick={() => {
          setReport(pendingReport.current ?? captureScoreDiagnostics());
          pendingReport.current = null;
          setCopyStatus('Bericht kopieren');
        }}
      >
        Diagnose
      </Button>
      <Dialog open={report !== null} onOpenChange={(open) => { if (!open) setReport(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Score-Diagnose</DialogTitle>
            <DialogDescription>
              Der Zustand wurde vor dem Öffnen erfasst. Bitte den Screenshot und diesen Bericht
              zusammen mit der betroffenen Zeile und Spielerspalte aufbewahren. Der Bericht enthält
              Spielwerte, aber keine Spielernamen oder Raum-ID.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => void copyReport()}>{copyStatus}</Button>
          <textarea
            aria-label="Diagnosebericht"
            readOnly
            value={report ?? ''}
            className="h-48 w-full rounded border bg-background p-2 font-mono text-xs"
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
