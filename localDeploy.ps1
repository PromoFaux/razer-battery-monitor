# Stream Deck Plugin Build and Deploy Script
# Bumps version, builds, packages, and installs the Razer Battery Monitor plugin

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("patch", "minor", "major")]
    [string]$BumpType = "patch"
)

Write-Host "Building and deploying Stream Deck Plugin..." -ForegroundColor Green

# Function to increment version number
function Bump-Version {
    param([string]$Version, [string]$Type)
    
    $versionParts = $Version.Split('.')
    $major = [int]$versionParts[0]
    $minor = [int]$versionParts[1] 
    $patch = [int]$versionParts[2]
    $build = [int]$versionParts[3]
    
    switch ($Type) {
        "major" { 
            $major++; $minor = 0; $patch = 0; $build = 0 
        }
        "minor" { 
            $minor++; $patch = 0; $build = 0 
        }
        "patch" { 
            $patch++; $build = 0 
        }
        default { 
            $build++ 
        }
    }
    
    return "$major.$minor.$patch.$build"
}

try {
    # Step 1: Read current version from manifest
    Write-Host "Reading current version..." -ForegroundColor Yellow
    $manifestPath = "com.promofaux.razer-battery-monitor.sdPlugin\manifest.json"
    
    if (-not (Test-Path $manifestPath)) {
        throw "Manifest file not found at: $manifestPath"
    }
    
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $currentVersion = $manifest.Version
    Write-Host "   Current version: $currentVersion" -ForegroundColor Gray
    
    # Step 2: Bump version
    $newVersion = Bump-Version -Version $currentVersion -Type $BumpType
    Write-Host "Bumping version ($BumpType): $currentVersion -> $newVersion" -ForegroundColor Yellow
    
    # Update manifest
    $manifest.Version = $newVersion
    $manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath
    
    # Step 3: Build the project
    Write-Host "Building project..." -ForegroundColor Yellow
    $buildResult = npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build output: $buildResult" -ForegroundColor Red
        throw "Build failed with exit code $LASTEXITCODE"
    }
    Write-Host "   Build completed successfully" -ForegroundColor Green
    
    # Step 4: Create plugin package
    Write-Host "Packaging plugin..." -ForegroundColor Yellow
    $pluginDir = "com.promofaux.razer-battery-monitor.sdPlugin"
    $packageName = "com.promofaux.razer-battery-monitor.streamDeckPlugin"
    
    if (-not (Test-Path $pluginDir)) {
        throw "Plugin directory not found: $pluginDir"
    }
    
    # Use Stream Deck CLI to properly package the plugin
    Write-Host "   Running streamdeck pack..." -ForegroundColor Gray
    $packResult = streamdeck pack ".\$pluginDir\" -f 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Pack output: $packResult" -ForegroundColor Red
        throw "Packaging failed with exit code $LASTEXITCODE"
    }
    Write-Host "   Package created successfully" -ForegroundColor Green
    
    # Step 5: Install the plugin
    Write-Host "Installing plugin..." -ForegroundColor Yellow
    
    if (-not (Test-Path $packageName)) {
        throw "Package not found: $packageName"
    }
    
    # Try to auto-install the plugin
    Write-Host "   Opening plugin package..." -ForegroundColor Gray
    try {
        # Use Invoke-Item instead of Start-Process for better file association handling
        Invoke-Item (Resolve-Path $packageName).Path
        Write-Host "   Plugin package opened - Stream Deck should install it automatically" -ForegroundColor Green
    } catch {
        Write-Host "   Could not auto-open package. Please manually double-click:" -ForegroundColor Yellow
        Write-Host "   $(Resolve-Path $packageName)" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "Deployment completed successfully!" -ForegroundColor Green
    Write-Host "   Version: $newVersion" -ForegroundColor White
    Write-Host "   Package: $packageName" -ForegroundColor White
    Write-Host "   Check Stream Deck software - plugin should be installed" -ForegroundColor White
    
} catch {
    Write-Host ""
    Write-Host "Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}