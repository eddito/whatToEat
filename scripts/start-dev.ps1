param(
  [int]$Port = 3000,
  [switch]$NoClean
)

$ErrorActionPreference = "Stop"

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$selfPid = $PID

Write-Host "Workspace: $workspace"
Write-Host "Port: $Port"

$projectNextProcesses = Get-CimInstance Win32_Process |
  Where-Object {
    $_.ProcessId -ne $selfPid -and
    $_.CommandLine -and
    $_.CommandLine -match [regex]::Escape($workspace) -and
    $_.CommandLine -match "node.*next"
  }

foreach ($process in $projectNextProcesses) {
  Write-Host "Stopping stale Next.js process PID=$($process.ProcessId)"
  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 500

$portProcesses = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique
)

if ($portProcesses) {
  $blockingProcesses = foreach ($ownerPid in $portProcesses) {
    Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -eq $ownerPid }
  }

  $nextPortProcesses = @($blockingProcesses | Where-Object { $_.CommandLine -and $_.CommandLine -match "node.*next" })
  $otherPortProcesses = @($blockingProcesses | Where-Object { -not ($_.CommandLine -and $_.CommandLine -match "node.*next") })

  foreach ($process in $nextPortProcesses) {
    Write-Host "Stopping Next.js process on port $Port PID=$($process.ProcessId)"
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }

  Start-Sleep -Milliseconds 500

  if ($otherPortProcesses) {
    $details = $otherPortProcesses | ForEach-Object { "PID=$($_.ProcessId) $($_.Name) $($_.CommandLine)" }
    Write-Host "Port $Port is still occupied by another process:"
    $details | ForEach-Object { Write-Host $_ }
    Write-Host "Stop that process or run this script with another port, for example: pnpm dev:safe -- -Port 3101"
    exit 1
  }
}

if (-not $NoClean) {
  $nextDir = Join-Path $workspace ".next"
  if (Test-Path $nextDir) {
    $resolvedNextDir = (Resolve-Path $nextDir).Path
    if ($resolvedNextDir.StartsWith($workspace) -and (Split-Path $resolvedNextDir -Leaf) -eq ".next") {
      Write-Host "Cleaning stale .next directory"
      Remove-Item -LiteralPath $resolvedNextDir -Recurse -Force
    } else {
      throw "Refusing to remove unexpected path: $resolvedNextDir"
    }
  }
}

$pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if (-not $pnpm) {
  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
}

if (-not $pnpm) {
  throw "pnpm was not found in PATH. Install pnpm or run through the Codex bundled runtime."
}

Set-Location $workspace
Write-Host "Starting Next.js dev server..."
& $pnpm.Source exec next dev -H 127.0.0.1 -p $Port
