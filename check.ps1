# SecondDesk 本地 CI 检查脚本
# 使用方法：.\check.ps1

Write-Host "🔍 开始本地 CI 检查..." -ForegroundColor Cyan
Write-Host ""

# 1. 前端类型检查
Write-Host "📦 [1/4] 前端构建检查..." -ForegroundColor Yellow
bun run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 前端构建失败！" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 前端构建通过" -ForegroundColor Green
Write-Host ""

# 2. Rust 代码格式检查
Write-Host "🎨 [2/4] Rust 代码格式检查..." -ForegroundColor Yellow
Set-Location src-tauri
cargo fmt -- --check
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Rust 格式检查失败！运行 'cargo fmt' 修复" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "✅ Rust 格式检查通过" -ForegroundColor Green
Write-Host ""

# 3. Rust Clippy 检查
Write-Host "🔧 [3/4] Rust Clippy 检查..." -ForegroundColor Yellow
cargo clippy -- -D warnings
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Clippy 检查失败！" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "✅ Clippy 检查通过" -ForegroundColor Green
Write-Host ""

# 4. Rust 构建测试
Write-Host "🏗️  [4/4] Rust 构建测试..." -ForegroundColor Yellow
cargo build --release
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Rust 构建失败！" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "✅ Rust 构建通过" -ForegroundColor Green
Write-Host ""

Set-Location ..

Write-Host "🎉 所有检查通过！可以安全提交了" -ForegroundColor Green
