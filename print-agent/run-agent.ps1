# Watchdog launcher cho Hansungbolt Print Agent
# - Neu agent da chay -> thoat
# - Neu chua -> start node agent.js an (hidden), log ra agent-out.log / agent-err.log
# Chay boi Task Scheduler moi 5 phut + luc logon. Khong can admin.
$ErrorActionPreference = 'SilentlyContinue'
$dir = 'C:\hansungbolt-overtime\print-agent'

# Da co agent dang chay chua? (node dang chay agent.js — command line chua
# duong dan day du vi ben duoi start bang full path)
$running = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -match 'agent\.js' }
if ($running) { exit 0 }

# Rotate: giu log lan chay truoc thanh .old (Start-Process ghi de file moi)
$outLog = Join-Path $dir 'agent-out.log'
$errLog = Join-Path $dir 'agent-err.log'
foreach ($f in @($outLog, $errLog)) {
    if (Test-Path $f) { Move-Item -Force $f ($f + '.old') }
}

# Start-Process doc lap (khong chet theo phien cha), cua so an.
# Dung full path de check chong trung o tren nhan dien duoc chac chan.
Start-Process -FilePath 'node' -ArgumentList "`"$dir\agent.js`"" `
    -WorkingDirectory $dir -WindowStyle Hidden `
    -RedirectStandardOutput $outLog -RedirectStandardError $errLog
