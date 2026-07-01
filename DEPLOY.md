# CIS shell — deploy (Big-K server)

Static files only. Served by nginx at `https://bkweb3.bigk.co.uk/cis/`.
Requires `carbo-identity` to be running (see `Carbo-Identity/DEPLOY.md`).

SSH: `ssh bkweb3dev@192.168.89.101` (VPN on).

## 1. Put files on the server

```bash
sudo mkdir -p /opt/carbo/cis/shell
sudo chown -R bkweb3dev:bkweb3dev /opt/carbo/cis
# rsync/scp the Carbo-CIS/shell/ folder into /opt/carbo/cis/shell/
```

Example from your PC (PowerShell):

```powershell
scp -r "G:\My Coding Projects\Carbo-CIS\shell\*" bkweb3dev@192.168.89.101:~/cis_shell_upload/
# then on the server:
#   sudo cp -r ~/cis_shell_upload/* /opt/carbo/cis/shell/
```

## 2. config.json on the server

Keep relative bases (served behind the same nginx):

```json
{
  "appName": "Carbo Integrated System",
  "identityApiBase": "/identity/api",
  "maintenanceApiBase": "/maintenance/api"
}
```

## 3. Nginx

Add the `/cis/` location from `Carbo-Identity/nginx_identity.conf` to the HTTPS
server block, then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Open `https://bkweb3.bigk.co.uk/cis/` and sign in.

## Smoke test

1. Sign in as the bootstrap admin → you should see **Identity Admin**.
2. Create Simon (role `operations`) and Juliana (role `finance`).
3. Sign in as Simon → sees **Operations** + **Consumption**.
4. Sign in as Juliana → sees **Consumption** only.
