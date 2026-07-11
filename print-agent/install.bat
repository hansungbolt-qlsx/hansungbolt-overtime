@echo off
setlocal
cd /d "%~dp0"

echo === Cai dat Hansungbolt Print Agent ===
echo.

REM Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo LOI: Chua co Node.js.
    echo Vao https://nodejs.org tai ban LTS ve cai truoc, sau do chay lai install.bat.
    pause
    exit /b 1
)

echo Node.js OK. Version:
node --version
echo.

REM Check .env
if not exist ".env" (
    echo Chua co file .env. Copy .env.example thanh .env truoc khi cai.
    echo Sau khi copy, mo file .env va dien LOGIN_PASSWORD + PRINTER_NAME.
    pause
    exit /b 1
)

echo Cai dat npm packages (lan dau se lau ~5 phut vi tai Chromium ~200MB)...
call npm install
if errorlevel 1 (
    echo Loi npm install
    pause
    exit /b 1
)

echo.
echo === Cai dat xong ===
echo Chay agent bang cach double-click file start.bat
echo hoac chay lenh: npm start
echo.
pause
