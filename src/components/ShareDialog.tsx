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
import { Users, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ShareDialogProps {
  peerId: string;
  connectedPeers: string[];
  isConnecting: boolean;
  onConnect: (peerId: string) => void;
}

export const ShareDialog = ({
  peerId,
  connectedPeers,
  isConnecting,
  onConnect,
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

  const handleConnect = () => {
    if (remotePeerId.trim()) {
      onConnect(remotePeerId.trim());
      setRemotePeerId('');
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="bg-white/20 hover:bg-white/30 text-white border-0 relative"
        >
          <Users className="w-5 h-5" />
          {connectedPeers.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {connectedPeers.length}
            </span>
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
            </div>
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
                    className="text-xs font-mono bg-secondary px-3 py-2 rounded"
                  >
                    {id}
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
