# SecondDesk 本地 CI 检查脚本
# 使用方法：.\check.ps1

# 设置 UTF-8 编码
chcp 65001 | Out-Null
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Starting local CI check..." -ForegroundColor Cyan
Write-Host ""

# 1. Frontend build check
Write-Host "[1/4] Frontend build check..." -ForegroundColor Yellow
bun run build
$bunExitCode = $LASTEXITCODE
if ($bunExitCode -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Frontend build passed" -ForegroundColor Green
Write-Host ""

# 2. Rust format check
Write-Host "[2/4] Rust format check..." -ForegroundColor Yellow
Push-Location src-tauri
cargo fmt -- --check
$fmtExitCode = $LASTEXITCODE
if ($fmtExitCode -ne 0) {
    Write-Host "Rust format check failed! Run 'cargo fmt' to fix" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "Rust format check passed" -ForegroundColor Green
Write-Host ""

# 3. Rust Clippy check
Write-Host "[3/4] Rust Clippy check..." -ForegroundColor Yellow
cargo clippy -- -D warnings
$clippyExitCode = $LASTEXITCODE
if ($clippyExitCode -ne 0) {
    Write-Host "Clippy check failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "Clippy check passed" -ForegroundColor Green
Write-Host ""

# 4. Rust build test
Write-Host "[4/4] Rust build test..." -ForegroundColor Yellow
cargo build --release
$buildExitCode = $LASTEXITCODE
if ($buildExitCode -ne 0) {
    Write-Host "Rust build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "Rust build passed" -ForegroundColor Green
Write-Host ""

Pop-Location

Write-Host "All checks passed! Safe to commit" -ForegroundColor Green
