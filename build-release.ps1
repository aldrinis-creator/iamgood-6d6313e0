# Check-iN Android Build & Release Automation Script
# Run this script using: powershell -ExecutionPolicy Bypass -File .\build-release.ps1

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Starting Check-iN Android Build Process   " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Automatically increment versionCode in build.gradle
$gradlePath = "android/app/build.gradle"
if (Test-Path $gradlePath) {
    Write-Host "1. Incrementing versionCode in build.gradle..." -ForegroundColor Yellow
    $content = Get-Content $gradlePath
    $incremented = $false
    $newContent = foreach ($line in $content) {
        if ($line -match 'versionCode\s+(\d+)') {
            $currentCode = [int]$Matches[1]
            $newCode = $currentCode + 1
            $line = $line -replace "versionCode\s+\d+", "versionCode $newCode"
            Write-Host "   -> Bumped versionCode from $currentCode to $newCode" -ForegroundColor Green
            $incremented = $true
        }
        $line
    }
    Set-Content $gradlePath -Value $newContent
} else {
    Write-Error "Could not find android/app/build.gradle!"
    exit 1
}

# 2. Build the React web application
Write-Host "`n2. Building React/Vite web application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Web application build failed!"
    exit 1
}

# 3. Sync web assets into Android project
Write-Host "`n3. Syncing assets with Capacitor..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Error "Capacitor sync failed!"
    exit 1
}

# 4. Compile the signed Android App Bundle (AAB)
Write-Host "`n4. Compiling signed Android App Bundle (AAB)..." -ForegroundColor Yellow
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android
.\gradlew.bat bundleRelease
cd ..

if ($LASTEXITCODE -ne 0) {
    Write-Error "Gradle build failed!"
    exit 1
}

# 5. Copy output AAB to website assets folder and local builds folder
Write-Host "`n5. Copying build artifacts..." -ForegroundColor Yellow
$sourceAAB = "android/app/build/outputs/bundle/release/app-release.aab"
$webAssetsPath = "../checkedin/assets/app-release.aab"
$localBuildsDir = "./builds"

if (!(Test-Path $localBuildsDir)) {
    New-Item -ItemType Directory -Path $localBuildsDir | Out-Null
}

$destAAB = "$localBuildsDir/app-release-v$newCode.aab"

if (Test-Path $sourceAAB) {
    # Copy to local builds directory
    Copy-Item -Path $sourceAAB -Destination $destAAB -Force
    Write-Host "   -> Local backup saved to: $destAAB" -ForegroundColor Green
    
    # Copy to website assets directory
    if (Test-Path "../checkedin") {
        Copy-Item -Path $sourceAAB -Destination $webAssetsPath -Force
        Write-Host "   -> Website asset updated at: $webAssetsPath" -ForegroundColor Green
        Write-Host "`nRemember to commit and push the updated website asset if you host the file online!" -ForegroundColor Magenta
    }
} else {
    Write-Error "Build succeeded, but the AAB file was not found at $sourceAAB"
    exit 1
}

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "        Build Completed Successfully!        " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
