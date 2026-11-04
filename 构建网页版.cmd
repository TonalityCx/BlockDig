@echo off
cd /d "%~dp0"
node tools\runtime.cjs build
pause
