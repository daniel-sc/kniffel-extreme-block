import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Copy, Check, Loader2, RefreshCcw, Share2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ShareDialogProps {
  roomId: string;
  remoteCount: number;
  isConnecting: boolean;
  syncMode: 'sync' | 'offline';
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  onConnect: (roomId: string) => Promise<void>;
  onResetRoomId: () => void;
  onWorkOffline: () => void;
  onResumeSync: () => Promise<void>;
}

export const ShareDialog = ({
  roomId,
  remoteCount,
  isConnecting,
  syncMode,
  connectionStatus,
  onConnect,
  onResetRoomId,
  onWorkOffline,
  onResumeSync,
}: ShareDialogProps) => {
  const [targetRoomId, setTargetRoomId] = useState('');
  const [copied, setCopied] = useState(false);

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      toast({
        title: 'Raum-ID kopiert!',
        description: 'Teile diese ID mit deinen Geräten oder Mitspielern',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Fehler',
        description: 'Raum-ID konnte nicht kopiert werden',
        variant: 'destructive',
      });
    }
  };

  const copyShareLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomId);
      await navigator.clipboard.writeText(url.toString());
      toast({
        title: 'Link kopiert!',
        description: 'Mit diesem Link wird direkt derselbe Raum genutzt',
      });
    } catch {
      toast({
        title: 'Fehler',
        description: 'Link konnte nicht kopiert werden',
        variant: 'destructive',
      });
    }
  };

  const handleConnect = async () => {
    if (!targetRoomId.trim()) return;

    try {
      await onConnect(targetRoomId.trim());
      setTargetRoomId('');
      toast({
        title: 'Raum gewechselt',
        description: 'Du bist jetzt mit dem gewünschten Raum verbunden',
      });
    } catch (err) {
      toast({
        title: 'Verbindungsfehler',
        description: err instanceof Error ? err.message : 'Konnte den Raum nicht öffnen.',
        variant: 'destructive',
      });
    }
  };

  const handleResetRoomId = () => {
    onResetRoomId();
    toast({
      title: 'Neue Raum-ID erzeugt',
      description: 'Du bist jetzt in einem neuen stabilen Raum.',
    });
  };

  const handleWorkOffline = () => {
    onWorkOffline();
    toast({
      title: 'Offline-Modus aktiv',
      description: 'Die Bearbeitung laeuft jetzt nur lokal, bis du Sync fortsetzt.',
    });
  };

  const handleResumeSync = async () => {
    try {
      await onResumeSync();
      toast({
        title: 'Sync fortgesetzt',
        description: 'Die Verbindung zum Raum wird wieder aufgebaut.',
      });
    } catch (err) {
      toast({
        title: 'Verbindungsfehler',
        description: err instanceof Error ? err.message : 'Konnte den Raum nicht oeffnen.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="relative"
        >
          <Users className="w-5 h-5" />
          {isConnecting ? (
            <span className="absolute -top-1 -right-1 bg-secondary text-foreground rounded-full w-5 h-5 flex items-center justify-center">
              <Loader2 className="w-3 h-3 animate-spin" />
            </span>
          ) : remoteCount > 0 ? (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {remoteCount}
            </span>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Live-Synchronisierung</DialogTitle>
          <DialogDescription>
            Nutze einen stabilen Raum für Live-Sync über alle Geräte
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            {syncMode === 'offline' ? (
              <p className="text-muted-foreground">Offline-Modus aktiv. Es findet keine Synchronisierung statt.</p>
            ) : connectionStatus === 'connected' ? (
              <p className="text-muted-foreground">Mit dem Raum verbunden.</p>
            ) : connectionStatus === 'connecting' ? (
              <p className="text-muted-foreground">Verbindung zum Raum wird aufgebaut.</p>
            ) : (
              <p className="text-muted-foreground">Momentan nicht mit dem Raum verbunden.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Aktuelle Raum-ID</Label>
            <div className="flex gap-2">
              <Input value={roomId || 'Lädt...'} readOnly className="font-mono text-sm" />
              <Button type="button" size="icon" onClick={copyRoomId} disabled={!roomId}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button type="button" size="icon" onClick={copyShareLink} disabled={!roomId}>
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleResetRoomId}
              disabled={!roomId}
            >
              <RefreshCcw className="h-4 w-4" />
              Neue Raum-ID erzeugen
            </Button>
            <p className="text-xs text-muted-foreground">
              Diese Raum-ID wird lokal gespeichert und dauerhaft wiederverwendet.
            </p>
            {syncMode === 'offline' ? (
              <Button type="button" className="w-full" onClick={() => void handleResumeSync()} disabled={isConnecting}>
                {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sync fortsetzen'}
              </Button>
            ) : (
              <Button type="button" variant="outline" className="w-full" onClick={handleWorkOffline}>
                Offline arbeiten
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-room-id">Bestehendem Raum beitreten</Label>
            <div className="flex gap-2">
              <Input
                id="target-room-id"
                placeholder="Raum-ID eingeben"
                value={targetRoomId}
                onChange={(e) => setTargetRoomId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleConnect()}
                className="font-mono text-sm"
              />
              <Button
                onClick={() => void handleConnect()}
                disabled={!targetRoomId.trim() || isConnecting}
              >
                {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Beitreten'}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Aenderungen werden als kompletter Spielzustand in denselben Raum uebertragen.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
