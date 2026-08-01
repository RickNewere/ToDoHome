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
    [string]$OrgName = 'Casa',
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

# Windows PowerShell hands a JSON array back from Invoke-RestMethod as a single
# object, so @(...) wraps it instead of flattening it. Left alone, a filter like
# $list | Where-Object { $_.name -eq 'x' } then matches the whole array and every
# value gets collected at once. This forces a genuinely flat list.
function ConvertTo-FlatList {
    param($Value)

    $out = New-Object System.Collections.ArrayList
    foreach ($item in $Value) {
        if ($item -is [System.Collections.IEnumerable] -and $item -isnot [string]) {
            foreach ($inner in $item) { [void]$out.Add($inner) }
        } else {
            [void]$out.Add($item)
        }
    }
    return $out.ToArray()
}

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
# A brand new Supabase account has none, so create one on the fly.

$orgs = ConvertTo-FlatList (Invoke-Supabase GET '/v1/organizations')
if ($orgs.Count -eq 0) {
    Write-Host "Nessuna organizzazione trovata, ne creo una chiamata '$OrgName'..."
    Invoke-Supabase POST '/v1/organizations' @{ name = $OrgName } | Out-Null
    # Read the list back rather than trusting the create response: it is the
    # only way to be sure the organisation is really there.
    Start-Sleep -Seconds 3
    $orgs = ConvertTo-FlatList (Invoke-Supabase GET '/v1/organizations')
}

if ($orgs.Count -eq 0) { throw 'Impossibile creare o leggere una organizzazione Supabase.' }

$org = $orgs[0]
$orgSlug = if ($org.slug) { $org.slug } else { $org.id }
if ([string]::IsNullOrWhiteSpace($orgSlug)) { throw 'Slug organizzazione non determinabile.' }
Write-Host "Organizzazione: $($org.name) [$orgSlug]"

# --- Project ---------------------------------------------------------------

$projects = ConvertTo-FlatList (Invoke-Supabase GET '/v1/projects')
$project = $projects | Where-Object { $_.name -eq $ProjectName } | Select-Object -First 1

if ($project) {
    Write-Host "Progetto '$ProjectName' gia esistente, lo riuso."
} else {
    Write-Host "Creo il progetto '$ProjectName' in $Region..."

    $chars = [char[]]((48..57) + (65..90) + (97..122))
    $dbPass = -join (1..32 | ForEach-Object { $chars | Get-Random })

    $project = Invoke-Supabase POST '/v1/projects' @{
        name              = $ProjectName
        organization_slug = $orgSlug
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

$keys = ConvertTo-FlatList (Invoke-Supabase GET "/v1/projects/$ref/api-keys?reveal=true")
$anon = $keys |
    Where-Object { $_.name -eq 'anon' -and $_.type -eq 'legacy' } |
    Select-Object -First 1 -ExpandProperty api_key

# The endpoint also returns service_role and the secret key, which must never
# reach the browser bundle. Refuse anything that is not one clean token.
if ($anon -isnot [string]) { throw 'Chiave anon non trovata o non univoca.' }
if ($anon -match '\s') { throw 'La chiave anon contiene spazi: sono state raccolte piu chiavi.' }
if ($anon.Length -lt 40) { throw 'La chiave anon sembra troncata.' }

$url = "https://$ref.supabase.co"

$envBody = "VITE_SUPABASE_URL=$url`nVITE_SUPABASE_ANON_KEY=$anon`n"
[System.IO.File]::WriteAllText(
    (Join-Path $root 'web\.env.local'),
    $envBody,
    [System.Text.UTF8Encoding]::new($false)
)
Write-Host 'Scritto web\.env.local'

# --- GitHub Actions secrets ------------------------------------------------

# Passed as arguments, never piped: piping through Windows PowerShell prepends
# a UTF-8 BOM to the value, which then travels into the built bundle.
gh secret set VITE_SUPABASE_URL      --repo $Repo --body $url  | Out-Null
gh secret set VITE_SUPABASE_ANON_KEY --repo $Repo --body $anon | Out-Null
Write-Host "Secret impostati su $Repo"

Write-Host ''
Write-Host "Fatto. Project URL: $url"
Write-Host 'La anon key non viene stampata: sta in web\.env.local e nei secret.'
