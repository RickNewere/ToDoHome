# Creates the Supabase project, loads the schema and the chore list, then wires
# the credentials into the local build and into the GitHub Actions secrets.
#
# The access token is read from a file and never printed. Same for the anon key
# and the generated database password: they are written straight to their
# destination, never to the console.
#
#   1. Log in at supabase.com
#   2. https://supabase.com/dashboard/account/tokens -> Generate new token
#   3. Save it into .supabase-token in the repository root
#   4. powershell -File scripts\setup-supabase.ps1

param(
    [string]$ProjectName = 'todohome',
    [string]$Region = 'eu-central-1',
    [string]$Repo = 'RickNewere/ToDoHome'
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path $PSScriptRoot -Parent
$tokenFile = Join-Path $root '.supabase-token'

if (-not (Test-Path $tokenFile)) {
    throw "Manca $tokenFile. Genera un token su https://supabase.com/dashboard/account/tokens e salvalo li dentro."
}

$token = ([System.IO.File]::ReadAllText($tokenFile)).Trim()
if ($token.Length -lt 20) { throw 'Il token nel file sembra vuoto o troncato.' }

$api = 'https://api.supabase.com'
$auth = @{ Authorization = "Bearer $token" }

function Invoke-Supabase {
    param($Method, $Path, $Body)

    $uri = "$api$Path"
    if ($null -eq $Body) {
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $auth
    }
    # Explicit UTF-8 bytes: the seed contains emoji and accented text that
    # Windows PowerShell would otherwise mangle on the way out.
    $json = $Body | ConvertTo-Json -Depth 10 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $auth -Body $bytes `
        -ContentType 'application/json; charset=utf-8'
}

# --- Organisation ----------------------------------------------------------

$orgs = Invoke-Supabase GET '/v1/organizations'
if (-not $orgs) { throw 'Nessuna organizzazione sul tuo account Supabase.' }
$org = @($orgs)[0]
Write-Host "Organizzazione: $($org.name)"

# --- Project ---------------------------------------------------------------

$projects = @(Invoke-Supabase GET '/v1/projects')
$project = $projects | Where-Object { $_.name -eq $ProjectName } | Select-Object -First 1

if ($project) {
    Write-Host "Progetto '$ProjectName' gia esistente, lo riuso."
} else {
    Write-Host "Creo il progetto '$ProjectName' in $Region..."

    $chars = [char[]]((48..57) + (65..90) + (97..122))
    $dbPass = -join (1..32 | ForEach-Object { $chars | Get-Random })

    $project = Invoke-Supabase POST '/v1/projects' @{
        name              = $ProjectName
        organization_slug = $org.id
        db_pass           = $dbPass
        region            = $Region
        plan              = 'free'
    }

    # The database password is not recoverable later, so keep a local copy.
    [System.IO.File]::WriteAllText(
        (Join-Path $root '.supabase-db-password'),
        $dbPass,
        [System.Text.UTF8Encoding]::new($false)
    )
    Write-Host 'Password del database salvata in .supabase-db-password (non versionata).'
}

$ref = $project.id

# --- Wait until the database accepts connections ---------------------------

Write-Host 'Attendo che il progetto sia pronto (puo richiedere qualche minuto)...'
$deadline = (Get-Date).AddMinutes(10)
do {
    Start-Sleep -Seconds 10
    $status = (Invoke-Supabase GET "/v1/projects/$ref").status
    Write-Host "  stato: $status"
    if ((Get-Date) -gt $deadline) { throw 'Timeout: il progetto non e diventato attivo.' }
} while ($status -ne 'ACTIVE_HEALTHY')

# --- Schema and seed -------------------------------------------------------

foreach ($file in @('schema.sql', 'seed.sql')) {
    $path = Join-Path $root "supabase\$file"
    $sql = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    Write-Host "Eseguo supabase\$file..."
    Invoke-Supabase POST "/v1/projects/$ref/database/query" @{ query = $sql } | Out-Null
}

$counts = Invoke-Supabase POST "/v1/projects/$ref/database/query" @{
    query = 'select count(*)::int as faccende from public.chores where active'
}
Write-Host "Faccende caricate: $(@($counts)[0].faccende)"

# --- Credentials -----------------------------------------------------------

$keys = @(Invoke-Supabase GET "/v1/projects/$ref/api-keys?reveal=true")
$anon = ($keys | Where-Object { $_.name -eq 'anon' } | Select-Object -First 1).api_key
if (-not $anon) { throw 'Non ho trovato la chiave anon fra quelle restituite.' }

$url = "https://$ref.supabase.co"

$envBody = "VITE_SUPABASE_URL=$url`nVITE_SUPABASE_ANON_KEY=$anon`n"
[System.IO.File]::WriteAllText(
    (Join-Path $root 'web\.env.local'),
    $envBody,
    [System.Text.UTF8Encoding]::new($false)
)
Write-Host 'Scritto web\.env.local'

# --- GitHub Actions secrets ------------------------------------------------

$url  | gh secret set VITE_SUPABASE_URL      --repo $Repo | Out-Null
$anon | gh secret set VITE_SUPABASE_ANON_KEY --repo $Repo | Out-Null
Write-Host "Secret impostati su $Repo"

Write-Host ''
Write-Host "Fatto. Project URL: $url"
Write-Host 'La anon key non viene stampata: sta in web\.env.local e nei secret.'
