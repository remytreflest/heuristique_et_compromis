<#
.SYNOPSIS
    Lance le scenario de charge k6 (performance/k6-scenario.js) contre le prototype
    docker-compose et affiche les resultats EN DIRECT (dashboard web + console + CPU/mem/IO).

.DESCRIPTION
    1. Demarre (ou verifie) la stack docker-compose (app, db, redis, mailhog).
    2. Ouvre automatiquement le dashboard web temps reel de k6 (graphes RPS, latence, VUs)
       dans le navigateur par defaut : http://localhost:5665
    3. Echantillonne "docker stats" (CPU / memoire / IO) toutes les 2s pendant le run pour
       objectiver le goulot d'etranglement (CPU applicatif vs IO base/cache).
    4. Affiche la progression k6 (VUs, requetes, %) dans la console au fur et a mesure.
    5. A la fin, exporte : summary.json (resume machine-readable), dashboard.html (rapport
       HTML autonome du dashboard), docker-stats.csv (releves CPU/mem/IO), k6-console.log.
    6. Imprime un recapitulatif colore pass/fail des seuils du brief (p95 < 2s, erreurs < 1%).

.PARAMETER Rebuild
    Reconstruit l'image de l'app avant de lancer le test (docker compose up -d --build).

.PARAMETER NoDashboard
    N'ouvre pas automatiquement le navigateur sur le dashboard k6.

.EXAMPLE
    .\Watch-LoadTest.ps1
    Lance le test de charge complet (scenarios "recherche" + "reservation_burst") avec
    dashboard live.
#>

[CmdletBinding()]
param(
    [switch]$Rebuild,
    [switch]$NoDashboard
)

$ErrorActionPreference = "Stop"

# k6 ecrit ses symboles (coche, croix, puces) en UTF-8 : sans ceci, la console Windows par
# defaut (code page 850/1252) les affiche comme du charabia ("ÔÇ¥"...). Purement cosmetique,
# sans effet sur les donnees exportees (summary.json / CSV restent corrects dans tous les cas).
try {
    chcp 65001 | Out-Null
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PerfDir  = $PSScriptRoot
$Stamp    = Get-Date -Format "yyyyMMdd-HHmmss"
$ResultsDir = Join-Path $PerfDir "results\$Stamp"
New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null

function Write-Section($text) {
    Write-Host ""
    Write-Host "=== $text ===" -ForegroundColor Cyan
}

function Test-DockerRunning {
    try { docker info | Out-Null; return $LASTEXITCODE -eq 0 } catch { return $false }
}

# --- 1. Stack docker-compose --------------------------------------------------
Write-Section "Stack docker-compose"

if (-not (Test-DockerRunning)) {
    Write-Host "Docker Desktop ne repond pas. Demarre Docker Desktop puis relance ce script." -ForegroundColor Red
    exit 1
}

Push-Location $RepoRoot
try {
    if ($Rebuild) {
        docker compose up -d --build
    } else {
        docker compose up -d
    }
    if ($LASTEXITCODE -ne 0) { throw "docker compose up a echoue (code $LASTEXITCODE)." }

    Write-Host "Attente de la sante de l'app (http://localhost:3001)..." -NoNewline
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:3001" -UseBasicParsing -TimeoutSec 2 -MaximumRedirection 0 -ErrorAction SilentlyContinue
        } catch {
            $resp = $_.Exception.Response
        }
        if ($resp -and [int]$resp.StatusCode -lt 500) { $ready = $true; break }
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 2
    }
    Write-Host ""
    if (-not $ready) { throw "L'application ne repond pas apres 60s. Verifie 'docker compose logs app'." }
    Write-Host "App prete." -ForegroundColor Green

    $appContainerId = (docker compose ps -q app).Trim()
    if (-not $appContainerId) { throw "Impossible de retrouver le conteneur 'app'." }
    $networkName = (docker inspect $appContainerId --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}').Trim()
    Write-Host "Reseau docker detecte : $networkName"
}
finally {
    Pop-Location
}

# --- 2. Echantillonnage CPU / memoire / IO en tache de fond --------------------
Write-Section "Echantillonnage CPU / memoire / IO (docker stats)"

$statsCsv = Join-Path $ResultsDir "docker-stats.csv"

# Deduit le prefixe de projet compose (ex: "heuristique_et_compromis") a partir du nom reel
# du conteneur app deja resolu plus haut, pour cibler les 3 conteneurs applicatifs.
$appContainerName = (docker inspect $appContainerId --format '{{.Name}}').Trim() -replace '^/',''
$prefix = $appContainerName -replace '-app-1$', ''
$targets = @("$prefix-app-1", "$prefix-db-1", "$prefix-redis-1")

$statsJob = Start-Job -ScriptBlock {
    param($csvPath, $targets)
    "timestamp,container,cpu_perc,mem_usage,mem_perc,net_io,block_io,pids" | Out-File -FilePath $csvPath -Encoding utf8
    while ($true) {
        $ts = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
        $lines = docker stats --no-stream --format "{{.Container}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}},{{.PIDs}}" $targets 2>$null
        foreach ($line in $lines) {
            "$ts,$line" | Out-File -FilePath $csvPath -Append -Encoding utf8
        }
        Start-Sleep -Seconds 2
    }
} -ArgumentList $statsCsv, $targets

Write-Host "Echantillonnage demarre (job $($statsJob.Id)) -> $statsCsv"

# --- 3. Lancement k6 avec dashboard web live -----------------------------------
Write-Section "Test de charge k6 (dashboard live sur http://localhost:5665)"

$summaryJson  = Join-Path $ResultsDir "summary.json"
$dashboardHtml = Join-Path $ResultsDir "dashboard.html"
$k6Log = Join-Path $ResultsDir "k6-console.log"

# Chemins vus depuis le conteneur (le dossier performance/ est monte sur /scripts)
$summaryJsonInContainer = "/scripts/results/$Stamp/summary.json"
$dashboardHtmlInContainer = "/scripts/results/$Stamp/dashboard.html"

$dockerArgs = @(
    "run", "--rm",
    "--network", $networkName,
    "-p", "5665:5665",
    "-e", "BASE_URL=http://app:3000",
    "-e", "K6_WEB_DASHBOARD=true",
    "-e", "K6_WEB_DASHBOARD_EXPORT=$dashboardHtmlInContainer",
    "-v", "${PerfDir}:/scripts",
    "grafana/k6", "run",
    "--summary-export", $summaryJsonInContainer,
    "/scripts/k6-scenario.js"
)

$k6Job = Start-Job -ScriptBlock {
    param($dockerArgs, $log)
    & docker @dockerArgs 2>&1 | Tee-Object -FilePath $log
} -ArgumentList (,$dockerArgs), $k6Log

if (-not $NoDashboard) {
    Start-Sleep -Seconds 3
    Write-Host "Ouverture du dashboard live : http://localhost:5665" -ForegroundColor Yellow
    Start-Process "http://localhost:5665"
}

Write-Host "--- Sortie k6 (mise a jour en direct) ---" -ForegroundColor DarkGray
while ($k6Job.State -eq "Running") {
    Receive-Job -Job $k6Job
    Start-Sleep -Milliseconds 500
}
Receive-Job -Job $k6Job
Remove-Job -Job $k6Job -Force

# --- 4. Arret de l'echantillonnage ---------------------------------------------
Stop-Job -Job $statsJob | Out-Null
Remove-Job -Job $statsJob -Force

# --- 5. Recapitulatif colore ----------------------------------------------------
Write-Section "Recapitulatif"

if (Test-Path $summaryJson) {
    $summary = Get-Content $summaryJson -Raw | ConvertFrom-Json
    $metrics = $summary.metrics

    function Show-Threshold($label, $metricKey, $thresholdKey) {
        $m = $metrics.$metricKey
        if (-not $m) { Write-Host "  $label : metrique introuvable" -ForegroundColor DarkYellow; return }
        $breached = $m.thresholds.$thresholdKey
        $p95 = if ($m.'p(95)') { [math]::Round($m.'p(95)', 1) } else { $null }
        $color = if ($breached) { "Red" } else { "Green" }
        $status = if ($breached) { "DEPASSE" } else { "OK" }
        Write-Host ("  {0,-45} p95={1,8} ms  seuil {2}  -> {3}" -f $label, $p95, $thresholdKey, $status) -ForegroundColor $color
    }

    Show-Threshold "recherche (500 VUs)"          "http_req_duration{scenario:recherche}"          "p(95)<2000"
    Show-Threshold "reservation_burst (150 VUs)"  "http_req_duration{scenario:reservation_burst}"  "p(95)<2000"

    $failed = $metrics.http_req_failed
    if ($failed) {
        $rate = [math]::Round($failed.value * 100, 2)
        $color = if ($rate -gt 1) { "Red" } else { "Green" }
        Write-Host ("  {0,-45} taux={1,7}%  seuil rate<1%%  -> {2}" -f "http_req_failed (global)", $rate, $(if ($rate -gt 1) {"DEPASSE"} else {"OK"})) -ForegroundColor $color
    }

    Write-Host ""
    if ($metrics.booking_confirmed) { Write-Host "  Reservations confirmees : $($metrics.booking_confirmed.count)" }
    if ($metrics.booking_conflict)  { Write-Host "  Conflits 409 (attendus) : $($metrics.booking_conflict.count)" }
    if ($metrics.booking_error)     { Write-Host "  Erreurs de reservation  : $($metrics.booking_error.count)" }
} else {
    Write-Host "summary.json introuvable - verifie $k6Log" -ForegroundColor Yellow
}

if (Test-Path $statsCsv) {
    Write-Host ""
    Write-Host "Pic CPU par conteneur pendant le run :"
    Import-Csv $statsCsv | Group-Object container | ForEach-Object {
        $max = ($_.Group | ForEach-Object { [double]($_.cpu_perc -replace '%','') } | Measure-Object -Maximum).Maximum
        Write-Host ("  {0,-45} CPU max = {1}%" -f $_.Name, $max)
    }
}

Write-Section "Fichiers generes"
Write-Host "  Resume k6 (JSON)      : $summaryJson"
Write-Host "  Dashboard live (HTML) : $dashboardHtml"
Write-Host "  Releves CPU/mem/IO    : $statsCsv"
Write-Host "  Log console complet   : $k6Log"
Write-Host ""
Write-Host "Pour arreter la stack : docker compose down (depuis la racine du depot)" -ForegroundColor DarkGray
