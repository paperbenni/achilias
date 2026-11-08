"use client";

import { Download, Smartphone } from "lucide-react";
import { usePwa } from "./pwa-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";

export function InstallCard() {
  const app = usePwa();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-4" /> Achilias on your device
        </CardTitle>
        <CardDescription>
          Open your workspace from your home screen or desktop, in its own app window.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed">
        {!app.ready ? (
          <p>Checking installation options…</p>
        ) : app.installed ? (
          <Badge variant="secondary">Achilias is installed</Badge>
        ) : !app.secure ? (
          <p>Open Achilias over HTTPS to install it on this device. Localhost also works on the computer running the server.</p>
        ) : (
          <>
            {app.canInstall && (
              <Button onClick={app.install} disabled={app.installing}>
                <Download /> Install Achilias
              </Button>
            )}
            <p>{app.ios
              ? 'On iPhone or iPad, open the browser’s Share menu, choose “Add to Home Screen”, then “Add”. Enable “Open as Web App” if offered.'
              : 'Use “Install app” or “Add to Home screen” in your browser’s menu. On desktop Safari, use File → Add to Dock. Available options depend on your browser.'}</p>
          </>
        )}
        {app.error && <p role="alert">{app.error}</p>}
        <p className="text-muted-foreground">
          Courses, files, discussions, and saving changes need a connection.
          Offline launches show a reconnect screen. Your existing bookmarks stay on this device.
        </p>
        {app.offlineStatus === "ready" && (
          <p className="text-muted-foreground">Offline launch is ready on this device.</p>
        )}
        {app.ready && app.offlineStatus === "pending" && (
          <p role="status">Preparing offline launch…</p>
        )}
        {app.offlineStatus === "failed" && (
          <div className="space-y-2">
            <p role="status">Offline launch couldn’t be set up. Check your connection and try again.</p>
            <Button variant="outline" onClick={app.retrySetup}>Retry offline setup</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
