# Chuyen 1 sheet cua file xlsx thanh PDF bang Excel COM (giu nguyen page setup
# fit-A4 da nhung trong file). Agent goi khi in job khsx_tong / khsx_homnay.
param(
    [Parameter(Mandatory=$true)][string]$InFile,
    [Parameter(Mandatory=$true)][string]$OutFile,
    [Parameter(Mandatory=$true)][string]$SheetName
)
$ErrorActionPreference = 'Stop'
$excel = $null
$wb = $null
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $wb = $excel.Workbooks.Open($InFile, 0, $true)   # read-only
    $ws = $wb.Worksheets.Item($SheetName)
    # 0 = xlTypePDF
    $ws.ExportAsFixedFormat(0, $OutFile)
    Write-Output "OK $OutFile"
} finally {
    if ($wb) { $wb.Close($false) | Out-Null }
    if ($excel) {
        $excel.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
}
