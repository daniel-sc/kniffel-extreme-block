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
import { Users, Copy, Check, Loader2, RefreshCcw, X, Share2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ShareDialogProps {
  peerId: string;
  connectedPeers: string[];
  isConnecting: boolean;
  isReconnecting: boolean;
  onConnect: (peerId: string) => Promise<void>;
  onRemovePeer: (peerId: string) => void;
  onResetPeerId: () => void;
}

export const ShareDialog = ({
  peerId,
  connectedPeers,
  isConnecting,
  isReconnecting,
  onConnect,
  onRemovePeer,
  onResetPeerId,
}: ShareDialogProps) => {
  const [remotePeerId, setRemotePeerId] = useState('');
  const [copied, setCopied] = useState(false);

  const copyPeerId = async () => {
    try {
      await navigator.clipboard.writeText(peerId);
      setCopied(true);
      toast({
        title: 'ID kopiert!',
        description: 'Teile diese ID mit deinen Mitspielern',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: 'Fehler',
        description: 'ID konnte nicht kopiert werden',
        variant: 'destructive',
      });
    }
  };

  const copyShareLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('peer', peerId);
      await navigator.clipboard.writeText(url.toString());
      toast({
        title: 'Link kopiert!',
        description: 'Mit diesem Link kann direkt verbunden werden',
      });
    } catch (err) {
      toast({
        title: 'Fehler',
        description: 'Link konnte nicht kopiert werden',
        variant: 'destructive',
      });
    }
  };

  const handleConnect = async () => {
    if (remotePeerId.trim()) {
      try {
        await onConnect(remotePeerId.trim());
        setRemotePeerId('');
        toast({
          title: 'Verbunden!',
          description: 'Erfolgreich mit Mitspieler verbunden',
        });
      } catch (err) {
        toast({
          title: 'Verbindungsfehler',
          description: err instanceof Error ? err.message : 'Konnte nicht verbinden. Prüfe die ID.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleResetPeerId = () => {
    onResetPeerId();
    toast({
      title: 'Peer-ID zurückgesetzt',
      description: 'Alle Verbindungen wurden getrennt.',
    });
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
          {isReconnecting ? (
            <span className="absolute -top-1 -right-1 bg-secondary text-foreground rounded-full w-5 h-5 flex items-center justify-center">
              <Loader2 className="w-3 h-3 animate-spin" />
            </span>
          ) : (
            connectedPeers.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {connectedPeers.length}
              </span>
            )
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Multiplayer Sync</DialogTitle>
          <DialogDescription>
            Verbinde dich mit anderen Spielern für Live-Sync
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Your ID */}
          <div className="space-y-2">
            <Label>Deine ID</Label>
            <div className="flex gap-2">
              <Input value={peerId || 'Lädt...'} readOnly className="font-mono text-sm" />
              <Button
                type="button"
                size="icon"
                onClick={copyPeerId}
                disabled={!peerId}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button
                type="button"
                size="icon"
                onClick={copyShareLink}
                disabled={!peerId}
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleResetPeerId}
              disabled={!peerId}
            >
              <RefreshCcw className="h-4 w-4" />
              ID zurücksetzen
            </Button>
            <p className="text-xs text-muted-foreground">
              Teile diese ID mit anderen Spielern
            </p>
          </div>

          {/* Connect to peer */}
          <div className="space-y-2">
            <Label htmlFor="remote-id">Mitspieler ID</Label>
            <div className="flex gap-2">
              <Input
                id="remote-id"
                placeholder="ID eingeben"
                value={remotePeerId}
                onChange={(e) => setRemotePeerId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                className="font-mono text-sm"
              />
              <Button
                onClick={handleConnect}
                disabled={!remotePeerId.trim() || isConnecting}
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Verbinden'
                )}
              </Button>
            </div>
          </div>

          {/* Connected peers */}
          {connectedPeers.length > 0 && (
            <div className="space-y-2">
              <Label>Verbundene Spieler ({connectedPeers.length})</Label>
              <div className="space-y-1">
                {connectedPeers.map((id) => (
                  <div
                    key={id}
                    className="flex items-center gap-2 bg-secondary px-3 py-2 rounded"
                  >
                    <span className="text-xs font-mono flex-1">{id}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemovePeer(id)}
                      aria-label="Verbindung trennen"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            💡 Änderungen werden automatisch zwischen allen verbundenen Geräten synchronisiert
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
