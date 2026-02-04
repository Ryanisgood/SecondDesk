# SecondDesk Release Script
# Usage: .\release.ps1 -Version "1.2.0"

param(
    [string]$Version,
    [switch]$SkipBuild,
    [switch]$SkipCI
)

# 设置 UTF-8 编码
chcp 65001 | Out-Null
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "SecondDesk Release Tool" -ForegroundColor Cyan
Write-Host ""

# Get version if not provided
if (-not $Version) {
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $currentVersion = $packageJson.version
    Write-Host "Current version: $currentVersion" -ForegroundColor Yellow
    $Version = Read-Host "Enter new version (e.g. 1.2.0)"
}

# Validate version format
if (-not ($Version -match '^\d+\.\d+\.\d+$')) {
    Write-Host "Invalid version format! Use x.y.z" -ForegroundColor Red
    exit 1
}

# Read release notes (only first section, up to first ---)
$notesFile = "RELEASE_NOTES.md"
if (Test-Path $notesFile) {
    $fullContent = Get-Content $notesFile -Raw -Encoding UTF8
    # 按 "---" 分隔，只取第一部分
    $sections = $fullContent -split '(?m)^---\s*$'
    $Notes = $sections[0].Trim()
    Write-Host "Release notes loaded from $notesFile (first section only)" -ForegroundColor Green
}
else {
    $Notes = "Release v$Version"
}

Write-Host ""
Write-Host "Releasing version: v$Version" -ForegroundColor Cyan
Write-Host ""

# ==================== Step 1: Update version numbers ====================
Write-Host "[1/9] Updating version numbers..." -ForegroundColor Yellow

# Update package.json
$content = Get-Content "package.json" -Raw -Encoding UTF8
$content = $content -replace '"version": "\d+\.\d+\.\d+"', "`"version`": `"$Version`""
[System.IO.File]::WriteAllText("$PWD\package.json", $content, [System.Text.UTF8Encoding]::new($false))

# Update tauri.conf.json
$content = Get-Content "src-tauri/tauri.conf.json" -Raw -Encoding UTF8
$content = $content -replace '"version": "\d+\.\d+\.\d+"', "`"version`": `"$Version`""
[System.IO.File]::WriteAllText("$PWD\src-tauri\tauri.conf.json", $content, [System.Text.UTF8Encoding]::new($false))

# Update Cargo.toml
$content = Get-Content "src-tauri/Cargo.toml" -Raw -Encoding UTF8
$content = $content -replace 'version = "\d+\.\d+\.\d+"', "version = `"$Version`""
[System.IO.File]::WriteAllText("$PWD\src-tauri\Cargo.toml", $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "Done" -ForegroundColor Green
Write-Host ""

# ==================== Step 2: CI check ====================
if (-not $SkipCI) {
    Write-Host "[2/9] Running CI check..." -ForegroundColor Yellow
    & .\check.ps1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "CI check failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
} else {
    Write-Host "[2/9] Skipping CI check..." -ForegroundColor Gray
}

# ==================== Step 3: Build ====================
if (-not $SkipBuild) {
    Write-Host "[3/9] Building application..." -ForegroundColor Yellow
    
    # 设置签名环境变量（如果存在）
    $privateKeyFile = "$PWD\.tauri-private-key"
    if (Test-Path $privateKeyFile) {
        $lines = Get-Content $privateKeyFile
        $env:TAURI_SIGNING_PRIVATE_KEY = $lines[0]
        if ($lines.Count -ge 2) {
            $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $lines[1]
            Write-Host "Private key and password loaded from .tauri-private-key" -ForegroundColor Green
        } else {
            Write-Host "Private key loaded from .tauri-private-key (no password)" -ForegroundColor Yellow
        }
    }
    
    if ($env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
        Write-Host "Password already set in environment" -ForegroundColor Green
    } elseif (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
        Write-Host "Warning: No signing key configured. Build will not be signed." -ForegroundColor Yellow
    }
    
    bun run tauri:build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Build completed" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[3/9] Skipping build..." -ForegroundColor Gray
}

# ==================== Step 4: Generate latest.json ====================
Write-Host "[4/9] Generating latest.json..." -ForegroundColor Yellow

# 查找实际的 MSI 文件（文件名可能因版本而异）
$msiFiles = Get-ChildItem "src-tauri\target\release\bundle\msi" -Filter "*.msi" -ErrorAction SilentlyContinue
if ($msiFiles.Count -eq 0) {
    Write-Host "  Warning: No MSI file found" -ForegroundColor Yellow
    $msiPath = ""
    $msiSig = ""
    $msiFileName = ""
} else {
    $msiFile = $msiFiles[0]
    $msiPath = $msiFile.FullName
    $msiFileName = $msiFile.Name

    # 读取签名文件
    if (Test-Path "$msiPath.sig") {
        $msiSig = (Get-Content "$msiPath.sig" -Raw).Trim()
        Write-Host "  MSI signature found: $msiFileName" -ForegroundColor Green
    } else {
        Write-Host "  Warning: MSI signature not found" -ForegroundColor Yellow
        $msiSig = ""
    }
}

# GitHub Release 下载 URL
$ghUser = "Ryanisgood"
$ghRepo = "SecondDesk"
$baseUrl = "https://github.com/$ghUser/$ghRepo/releases/download/v$Version"

# 生成 latest.json
$latestJson = @{
    version = $Version
    date = (Get-Date -Format "yyyy-MM-dd")
    platforms = @{
        "windows-x86_64" = @{
            signature = $msiSig
            url = "$baseUrl/$msiFileName"
        }
    }
    body = $Notes
} | ConvertTo-Json -Depth 4

# 保存 latest.json
$latestJsonPath = "$PWD\latest.json"
[System.IO.File]::WriteAllText($latestJsonPath, $latestJson, [System.Text.UTF8Encoding]::new($false))
Write-Host "Generated: $latestJsonPath" -ForegroundColor Green
Write-Host ""

# ==================== Step 5: Git commit ====================
Write-Host "[5/9] Committing changes..." -ForegroundColor Yellow
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml latest.json RELEASE_NOTES.md
git commit -m "release: v$Version"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git commit failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Done" -ForegroundColor Green

# ==================== Step 6: Create tag ====================
Write-Host "[6/9] Creating tag v$Version..." -ForegroundColor Yellow
git tag -a "v$Version" -m "$Notes"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tag creation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Done" -ForegroundColor Green
Write-Host ""

# ==================== Step 7: Push ====================
$push = Read-Host "Push to remote? (y/n)"
if ($push -eq 'y' -or $push -eq 'Y') {
    Write-Host "[7/9] Pushing to remote..." -ForegroundColor Yellow
    git push
    git push origin "v$Version"
    Write-Host "Done" -ForegroundColor Green
    
    # ==================== Step 8: Create GitHub Release ====================
    $ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
    if ($ghInstalled) {
        $createRelease = Read-Host "Create GitHub Release and upload assets? (y/n)"
        if ($createRelease -eq 'y' -or $createRelease -eq 'Y') {
            Write-Host "[8/9] Creating GitHub Release..." -ForegroundColor Yellow
            
            # 创建 Release
            gh release create "v$Version" --title "v$Version" --notes "$Notes"
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Failed to create GitHub Release!" -ForegroundColor Red
                exit 1
            }
            
            # ==================== Step 9: Upload assets ====================
            Write-Host "[9/9] Uploading release assets..." -ForegroundColor Yellow
            
            # 上传安装包
            if (Test-Path $nsisPath) {
                gh release upload "v$Version" $nsisPath --clobber
                Write-Host "  Uploaded: NSIS installer" -ForegroundColor Green
            }
            
            if (Test-Path $msiPath) {
                gh release upload "v$Version" $msiPath --clobber
                Write-Host "  Uploaded: MSI installer" -ForegroundColor Green
            }
            
            # 上传 latest.json (用于自动更新)
            gh release upload "v$Version" $latestJsonPath --clobber
            Write-Host "  Uploaded: latest.json" -ForegroundColor Green
            
            Write-Host "GitHub Release created successfully!" -ForegroundColor Green
        }
    } else {
        Write-Host "GitHub CLI (gh) not installed, skipping release creation" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "v$Version released successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Verify the GitHub Release at:" -ForegroundColor White
Write-Host "   https://github.com/$ghUser/$ghRepo/releases/tag/v$Version" -ForegroundColor Cyan
Write-Host "2. Test auto-update by running an older version" -ForegroundColor White
Write-Host ""
