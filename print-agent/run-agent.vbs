' Chay run-agent.ps1 HOAN TOAN khong cua so (Task Scheduler goi powershell
' truc tiep se loe khung den ~1s moi 5 phut - user phan anh 13/7).
CreateObject("Wscript.Shell").Run _
  "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\hansungbolt-overtime\print-agent\run-agent.ps1""", 0, False
