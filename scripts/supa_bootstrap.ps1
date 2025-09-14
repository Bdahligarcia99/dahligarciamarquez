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

Write-Host "Environment variables loaded" -ForegroundColor Green

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
    Write-Host "✅ Storage bucket created successfully" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "⚠️  Bucket already exists - continuing..." -ForegroundColor Yellow
    } else {
        Write-Host "❌ Error creating bucket: $($_.Exception.Message)" -ForegroundColor Red
        if (-not $Force) {
            exit 1
        }
    }
}

# Apply SQL files using REST API instead of psql
Write-Host "🗄️  Applying SQL schema files..." -ForegroundColor Yellow

$sqlFiles = @("01_schema.sql", "02_routines.sql", "03_policies.sql", "04_seed.sql")
$successCount = 0
$failedFiles = @()

foreach ($sqlFile in $sqlFiles) {
    $filePath = "supabase\sql\$sqlFile"
    if (Test-Path $filePath) {
        Write-Host "  📄 Applying $sqlFile..." -ForegroundColor Cyan
        
        try {
            $sqlContent = Get-Content $filePath -Raw
            
            # Use Supabase REST API to execute SQL
            $sqlPayload = @{
                query = $sqlContent
            } | ConvertTo-Json
            
            $response = Invoke-RestMethod -Uri "$($envVars['SUPABASE_URL'])/rest/v1/rpc/exec_sql" -Method Post -Body $sqlPayload -Headers $headers
            Write-Host "    ✅ $sqlFile applied successfully" -ForegroundColor Green
            $successCount++
        } catch {
            Write-Host "    ❌ Failed to apply $sqlFile : $($_.Exception.Message)" -ForegroundColor Red
            $failedFiles += $sqlFile
            
            # Try alternative method using direct database connection
            Write-Host "    🔄 Trying alternative method..." -ForegroundColor Yellow
            try {
                # Parse connection string
                $dbUrl = $envVars['SUPABASE_DB_URL']
                if ($dbUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
                    $dbUser = $matches[1]
                    $dbPassword = $matches[2]
                    $dbHost = $matches[3]
                    $dbPort = $matches[4]
                    $dbName = $matches[5]
                    
                    # Try using .NET PostgreSQL connection (if available)
                    Write-Host "    ℹ️  Alternative method would require PostgreSQL client installation" -ForegroundColor Blue
                    Write-Host "    ℹ️  Consider installing PostgreSQL client or using Supabase Dashboard" -ForegroundColor Blue
                }
            } catch {
                Write-Host "    ❌ Alternative method also failed" -ForegroundColor Red
            }
            
            if (-not $Force) {
                Write-Host "❌ SQL application failed. Use -Force to continue despite errors." -ForegroundColor Red
                exit 1
            }
        }
    } else {
        Write-Host "  ⚠️  File not found: $filePath" -ForegroundColor Yellow
    }
}

# Summary
Write-Host ""
Write-Host "📊 Bootstrap Summary:" -ForegroundColor Magenta
Write-Host "  ✅ SQL files applied successfully: $successCount" -ForegroundColor Green
if ($failedFiles.Count -gt 0) {
    Write-Host "  ❌ SQL files failed: $($failedFiles.Count) - $($failedFiles -join ', ')" -ForegroundColor Red
    Write-Host ""
    Write-Host "INFO: To resolve SQL execution issues:" -ForegroundColor Yellow
    Write-Host "  1. Install PostgreSQL client tools (includes psql)"
    Write-Host "  2. Or manually run the SQL files in Supabase Dashboard > SQL Editor"
    Write-Host "  3. Or use WSL with PostgreSQL client installed"
}

Write-Host ""
if ($failedFiles.Count -eq 0) {
    Write-Host "🎉 Supabase bootstrap completed successfully!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Supabase bootstrap completed with some issues" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Create an admin user via Supabase Auth Dashboard"
Write-Host "2. Update the admin profile UUID in the database"
Write-Host "3. Set environment variables on your hosting platforms"
Write-Host "4. Deploy and test the application"

if ($failedFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "🔧 To complete the setup, manually apply these SQL files:" -ForegroundColor Yellow
    foreach ($file in $failedFiles) {
        Write-Host "   - supabase\sql\$file" -ForegroundColor White
    }
}
