# Supabase Bootstrap Script (PowerShell version)
# Creates schema, policies, and storage bucket for storytelling website

param(
    [switch]$Force
)

Write-Host "Starting Supabase bootstrap..." -ForegroundColor Green

# Check if .env.supabase exists in server folder
if (-not (Test-Path "server\.env.supabase")) {
    Write-Host "ERROR: server\.env.supabase file not found" -ForegroundColor Red
    Write-Host "Please create server\.env.supabase with:"
    Write-Host "SUPABASE_URL=https://your-project.supabase.co"
    Write-Host "SUPABASE_ANON_KEY=your-anon-key"
    Write-Host "SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
    Write-Host "SUPABASE_DB_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres"
    exit 1
}

# Load environment variables from server folder
$envVars = @{}
Get-Content "server\.env.supabase" | ForEach-Object {
    if ($_ -match "^([^#][^=]+)=(.*)$") {
        $envVars[$matches[1]] = $matches[2]
    }
}

# Validate required variables
$requiredVars = @("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL")
$missingVars = @()

foreach ($var in $requiredVars) {
    if (-not $envVars.ContainsKey($var) -or [string]::IsNullOrWhiteSpace($envVars[$var])) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "ERROR: Missing required environment variables: $($missingVars -join ', ')" -ForegroundColor Red
    exit 1
}

Write-Host "SUCCESS: Environment variables loaded" -ForegroundColor Green

# Create Storage bucket using REST API
Write-Host "Creating Storage bucket 'post-images'..." -ForegroundColor Yellow

$bucketPayload = @{
    id = "post-images"
    name = "post-images"
    public = $true
    file_size_limit = 10485760
    allowed_mime_types = @("image/jpeg", "image/png", "image/webp", "image/gif")
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $($envVars['SUPABASE_SERVICE_ROLE_KEY'])"
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "$($envVars['SUPABASE_URL'])/storage/v1/bucket" -Method Post -Body $bucketPayload -Headers $headers
    Write-Host "SUCCESS: Storage bucket created" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "WARNING: Bucket already exists - continuing..." -ForegroundColor Yellow
    } else {
        Write-Host "ERROR creating bucket: $($_.Exception.Message)" -ForegroundColor Red
        if (-not $Force) {
            exit 1
        }
    }
}

Write-Host "Storage bucket setup complete" -ForegroundColor Green
Write-Host ""
Write-Host "MANUAL STEP REQUIRED:" -ForegroundColor Yellow
Write-Host "Since psql is not available, please manually apply the SQL files:" -ForegroundColor White
Write-Host "1. Go to your Supabase Dashboard > SQL Editor"
Write-Host "2. Copy and paste each file content in this order:"
Write-Host "   - supabase\sql\01_schema.sql"
Write-Host "   - supabase\sql\02_routines.sql" 
Write-Host "   - supabase\sql\03_policies.sql"
Write-Host "   - supabase\sql\04_seed.sql"
Write-Host ""
Write-Host "Next steps after SQL files are applied:"
Write-Host "1. Create an admin user via Supabase Auth Dashboard"
Write-Host "2. Update the admin profile UUID in the database"
Write-Host "3. Set environment variables on your hosting platforms"
Write-Host "4. Deploy and test the application"
