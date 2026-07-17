# Self-Hosted Runner Finalization

The repository already includes deployment workflow:
- `.github/workflows/deploy-self-hosted.yml`

The server already has runner binaries installed at:
- `/localhome/mtmluv001/actions-runner`

## 1) Get one-time runner registration token

In GitHub repository:
1. Settings
2. Actions
3. Runners
4. New self-hosted runner
5. Copy the registration token shown

## 2) Register and start runner on server

Run this on `string-1.cs.uct.ac.za`:

```
cd /localhome/mtmluv001/actions-runner
./config.sh --unattended \
  --url https://github.com/Vuyo17/string-conundrum \
  --token <PASTE_REGISTRATION_TOKEN> \
  --name string-1-runner \
  --labels self-hosted,linux,x64 \
  --replace

echo "<SUDO_PASSWORD>" | sudo -S -p '' ./svc.sh install mtmluv001
echo "<SUDO_PASSWORD>" | sudo -S -p '' ./svc.sh start
echo "<SUDO_PASSWORD>" | sudo -S -p '' ./svc.sh status
```

## 3) Add repository secret used by deploy workflow

In GitHub repository secrets, add:
- `SUDO_PASSWORD` = server sudo password for the runner user

## 4) Trigger deployment

Push to `main` with changes in `backend/**` or `frontend/**`, or run workflow manually:
- Actions -> Deploy (Self-Hosted Runner) -> Run workflow
